use regex::Regex;
use serde::Serialize;
use serde_json;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;
use std::process::Command;
use walkdir::WalkDir;

use crate::util;

#[derive(Serialize, Debug, Clone)]
#[cfg_attr(test, derive(serde::Deserialize))]
pub struct DepEntry {
    pub imported_by: Vec<String>,
    pub imports: Vec<String>,
    pub churn_30d: usize,
}

/// Build a dependency graph for changed files.
///
/// Single-pass approach: walk the project tree once, parse all import statements,
/// build a reverse-import map, then look up each changed file. O(project_size + N)
/// instead of O(N * project_size) from the old per-file grep approach.
pub fn run(
    project_root: &str,
    changed_files_str: &str,
    out_path: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let changed_files: Vec<&str> = changed_files_str
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    let import_re = Regex::new(r#"from\s+['"]([^'"]+)['"]"#)?;
    let mut graph: BTreeMap<String, DepEntry> = BTreeMap::new();

    // Build reverse-import map: for each file in the project, parse its imports
    // and record "target_basename -> [(importing_file, line_number)]"
    let reverse_map = build_reverse_import_map(project_root, &import_re);

    for cf in &changed_files {
        let mut entry = DepEntry {
            imported_by: Vec::new(),
            imports: Vec::new(),
            churn_30d: 0,
        };

        // Look up callers from the reverse-import map
        let basename = Path::new(cf)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        if !basename.is_empty() {
            if let Some(importers) = reverse_map.get(basename) {
                for (importer_path, line_num, import_specifier) in importers {
                    // Skip self-imports: compare full relative path
                    if importer_path == *cf {
                        continue;
                    }
                    // Verify import specifier ends with basename (path-anchored match)
                    let spec_basename = Path::new(import_specifier.as_str())
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");
                    if spec_basename == basename {
                        entry.imported_by.push(format!("{}:{}", importer_path, line_num));
                    }
                }
                entry.imported_by.truncate(20);
            }
        }

        // Parse imports from the file itself
        let full_path = Path::new(project_root).join(cf);
        if full_path.exists() {
            if let Ok(content) = fs::read_to_string(&full_path) {
                let mut imports: Vec<String> = import_re
                    .captures_iter(&content)
                    .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_string()))
                    .collect();
                imports.truncate(20);
                entry.imports = imports;
            }
        }

        // Git churn (commits in last 30 days)
        let mut cmd = Command::new("git");
        cmd.args(["log", "--oneline", "--since=30 days ago", "--", cf])
            .current_dir(project_root);
        if let Ok(output) = util::run_cmd(cmd, util::CMD_TIMEOUT) {
            let stdout = String::from_utf8_lossy(&output.stdout);
            entry.churn_30d = stdout.lines().filter(|l| !l.is_empty()).count();
        }

        graph.insert(cf.to_string(), entry);
    }

    let json = serde_json::to_string_pretty(&graph)?;
    fs::write(out_path, &json)?;
    Ok(format!("    {} files mapped", graph.len()))
}

/// Walk the project tree once, parse import statements from all TS/JS files,
/// and build a map from imported basename to list of (importer_path, line_number, import_specifier).
fn build_reverse_import_map(
    project_root: &str,
    import_re: &Regex,
) -> HashMap<String, Vec<(String, usize, String)>> {
    let mut reverse_map: HashMap<String, Vec<(String, usize, String)>> = HashMap::new();

    let root = Path::new(project_root);

    for entry in WalkDir::new(project_root)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_str().unwrap_or("");
            // Skip common non-source directories
            !matches!(
                name,
                "node_modules" | ".git" | "dist" | "build" | ".next" | "coverage" | ".claude"
            )
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if !matches!(ext, "ts" | "tsx" | "js" | "jsx") {
            continue;
        }

        let rel_path = match path.strip_prefix(root) {
            Ok(rel) => rel.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for (line_num_0, line) in content.lines().enumerate() {
            for cap in import_re.captures_iter(line) {
                if let Some(specifier) = cap.get(1) {
                    let spec = specifier.as_str();
                    // Extract the basename of the import specifier
                    let import_basename = Path::new(spec)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");
                    if !import_basename.is_empty() && import_basename != "." && import_basename != ".." {
                        reverse_map
                            .entry(import_basename.to_string())
                            .or_default()
                            .push((rel_path.clone(), line_num_0 + 1, spec.to_string()));
                    }
                }
            }
        }
    }

    reverse_map
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::TempDir;

    fn setup_project() -> TempDir {
        let dir = TempDir::new().unwrap();
        let root = dir.path();

        // Initialize git repo
        Command::new("git")
            .args(["init"])
            .current_dir(root)
            .output()
            .unwrap();
        Command::new("git")
            .args(["config", "user.email", "test@test.com"])
            .current_dir(root)
            .output()
            .unwrap();
        Command::new("git")
            .args(["config", "user.name", "test"])
            .current_dir(root)
            .output()
            .unwrap();

        // Create source files
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(
            root.join("src/foo.ts"),
            r#"import { bar } from './bar';
import { baz } from '../lib/baz';
export function foo() { return bar(); }
"#,
        )
        .unwrap();
        fs::write(
            root.join("src/bar.ts"),
            r#"export function bar() { return 42; }
"#,
        )
        .unwrap();
        fs::write(
            root.join("src/caller.ts"),
            r#"import { foo } from './foo';
console.log(foo());
"#,
        )
        .unwrap();

        // Initial commit
        Command::new("git")
            .args(["add", "-A"])
            .current_dir(root)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(root)
            .output()
            .unwrap();

        dir
    }

    #[test]
    fn test_dep_graph_basic() {
        let dir = setup_project();
        let root = dir.path().to_str().unwrap();
        let out = dir.path().join("dep-graph.json");

        let result = run(root, "src/foo.ts", out.to_str().unwrap());
        assert!(result.is_ok());
        assert!(result.unwrap().contains("1 files mapped"));

        let json: BTreeMap<String, DepEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        let entry = &json["src/foo.ts"];

        // foo.ts imports bar and baz
        assert!(entry.imports.contains(&"./bar".to_string()));
        assert!(entry.imports.contains(&"../lib/baz".to_string()));

        // caller.ts imports foo
        assert!(
            entry.imported_by.iter().any(|s| s.contains("caller.ts")),
            "Expected caller.ts in imported_by, got: {:?}",
            entry.imported_by
        );
    }

    #[test]
    fn test_dep_graph_no_false_positive_substring() {
        // Regression test for #3 and #4: substring-based matching
        let dir = setup_project();
        let root = dir.path();

        // Create files that would cause false positives with substring matching:
        // - sidebar.ts imports something (contains "bar" as substring)
        // - foo.tsx (should not be filtered as self-import of foo.ts)
        fs::write(
            root.join("src/sidebar.ts"),
            r#"import { x } from './sidebar-utils';
export function sidebar() {}
"#,
        )
        .unwrap();
        fs::write(
            root.join("src/foo.tsx"),
            r#"import { foo } from './foo';
export function FooComponent() {}
"#,
        )
        .unwrap();
        Command::new("git")
            .args(["add", "-A"])
            .current_dir(root)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "add sidebar and foo.tsx"])
            .current_dir(root)
            .output()
            .unwrap();

        let out = root.join("dep-graph.json");
        let result = run(root.to_str().unwrap(), "src/bar.ts", out.to_str().unwrap());
        assert!(result.is_ok());

        let json: BTreeMap<String, DepEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        let entry = &json["src/bar.ts"];

        // sidebar.ts should NOT appear as a caller of bar.ts (#3)
        assert!(
            !entry.imported_by.iter().any(|s| s.contains("sidebar.ts")),
            "sidebar.ts should not be a false positive caller of bar.ts, got: {:?}",
            entry.imported_by
        );

        // Now test that foo.tsx is NOT filtered out as self-import of foo.ts (#4)
        let out2 = root.join("dep-graph2.json");
        let result2 = run(root.to_str().unwrap(), "src/foo.ts", out2.to_str().unwrap());
        assert!(result2.is_ok());

        let json2: BTreeMap<String, DepEntry> =
            serde_json::from_str(&fs::read_to_string(&out2).unwrap()).unwrap();
        let entry2 = &json2["src/foo.ts"];
        assert!(
            entry2.imported_by.iter().any(|s| s.contains("foo.tsx")),
            "foo.tsx should be listed as caller of foo.ts (not filtered as self-import), got: {:?}",
            entry2.imported_by
        );
    }

    #[test]
    fn test_dep_graph_truncates() {
        let dir = setup_project();
        let root = dir.path();

        // Create a file with 25 imports
        let mut content = String::new();
        for i in 0..25 {
            content.push_str(&format!("import {{ x{i} }} from './mod{i}';\n"));
        }
        fs::write(root.join("src/many.ts"), &content).unwrap();
        Command::new("git")
            .args(["add", "-A"])
            .current_dir(root)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "add many"])
            .current_dir(root)
            .output()
            .unwrap();

        let out = root.join("dep-graph.json");
        run(root.to_str().unwrap(), "src/many.ts", out.to_str().unwrap()).unwrap();

        let json: BTreeMap<String, DepEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        let entry = &json["src/many.ts"];
        assert!(
            entry.imports.len() <= 20,
            "imports should be capped at 20, got {}",
            entry.imports.len()
        );
    }

    #[test]
    fn test_dep_graph_empty_files() {
        let dir = setup_project();
        let root = dir.path().to_str().unwrap();
        let out = dir.path().join("dep-graph.json");

        let result = run(root, "", out.to_str().unwrap());
        assert!(result.is_ok());
        assert!(result.unwrap().contains("0 files mapped"));
    }

    #[test]
    fn test_dep_graph_nonexistent_file() {
        let dir = setup_project();
        let root = dir.path().to_str().unwrap();
        let out = dir.path().join("dep-graph.json");

        let result = run(root, "does/not/exist.ts", out.to_str().unwrap());
        assert!(result.is_ok());

        let json: BTreeMap<String, DepEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        let entry = &json["does/not/exist.ts"];
        assert!(entry.imports.is_empty());
        assert_eq!(entry.churn_30d, 0);
    }
}
