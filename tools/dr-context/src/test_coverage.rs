use glob::glob;
use serde::Serialize;
use serde_json;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

#[derive(Serialize, Debug, Clone)]
#[cfg_attr(test, derive(serde::Deserialize))]
pub struct CoverageEntry {
    pub has_tests: bool,
    pub test_files: Vec<String>,
}

/// Directories to exclude from test file matching (#14).
const EXCLUDED_DIRS: &[&str] = &["node_modules/", "dist/", ".git/", ".next/", "build/"];

/// Check if a relative path should be excluded from test results.
fn is_excluded_path(rel_path: &str) -> bool {
    EXCLUDED_DIRS
        .iter()
        .any(|dir| rel_path.starts_with(dir) || rel_path.contains(&format!("/{}", dir)))
}

/// Check test coverage for changed files by looking for sibling test files.
///
/// Matches patterns: **/{name}.test.*, **/{name}.spec.*, **/__tests__/{name}.*
/// Prioritizes co-located tests (same directory subtree) over project-wide matches (#8).
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

    let root = Path::new(project_root);
    let mut coverage: BTreeMap<String, CoverageEntry> = BTreeMap::new();

    for cf in &changed_files {
        let basename = Path::new(cf)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        if basename.is_empty() {
            coverage.insert(
                cf.to_string(),
                CoverageEntry {
                    has_tests: false,
                    test_files: Vec::new(),
                },
            );
            continue;
        }

        // Escape glob metacharacters in basename (#19: brackets, *, ? in filenames)
        let safe_basename = escape_glob(basename);

        let mut found_tests: Vec<String> = Vec::new();

        // Phase 1: search co-located (same directory subtree) — prioritized (#8)
        let source_dir = Path::new(cf)
            .parent()
            .and_then(|p| p.to_str())
            .filter(|s| !s.is_empty());

        if let Some(dir) = source_dir {
            let colocated_patterns = [
                format!("{}/**/{}.test.*", dir, safe_basename),
                format!("{}/**/{}.spec.*", dir, safe_basename),
                format!("{}/**/__tests__/{}.*", dir, safe_basename),
            ];
            for pattern in &colocated_patterns {
                search_glob(root, pattern, &mut found_tests);
            }
        }

        // Phase 2: fall back to project-wide if no co-located tests found
        if found_tests.is_empty() {
            let global_patterns = [
                format!("**/tests/**/{}.test.*", safe_basename),
                format!("**/tests/**/{}.spec.*", safe_basename),
                format!("**/__tests__/{}.*", safe_basename),
                format!("**/{}.test.*", safe_basename),
                format!("**/{}.spec.*", safe_basename),
            ];
            for pattern in &global_patterns {
                search_glob(root, pattern, &mut found_tests);
            }
        }

        found_tests.truncate(5);

        coverage.insert(
            cf.to_string(),
            CoverageEntry {
                has_tests: !found_tests.is_empty(),
                test_files: found_tests,
            },
        );
    }

    let tested = coverage.values().filter(|v| v.has_tests).count();
    let total = coverage.len();

    let json = serde_json::to_string_pretty(&coverage)?;
    fs::write(out_path, &json)?;
    Ok(format!("    {}/{} files have tests", tested, total))
}

/// Search for files matching a glob pattern, filtering excluded directories.
fn search_glob(root: &Path, pattern: &str, results: &mut Vec<String>) {
    let full_pattern = root.join(pattern).to_string_lossy().to_string();
    if let Ok(entries) = glob(&full_pattern) {
        for entry in entries.flatten() {
            if let Ok(rel) = entry.strip_prefix(root) {
                let rel_str = rel.to_string_lossy().to_string();
                if !is_excluded_path(&rel_str) && !results.contains(&rel_str) {
                    results.push(rel_str);
                }
            }
        }
    }
}

/// Escape glob metacharacters in a string (#19).
fn escape_glob(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '[' | ']' | '*' | '?' => {
                result.push('[');
                result.push(c);
                result.push(']');
            }
            _ => result.push(c),
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup_project() -> TempDir {
        let dir = TempDir::new().unwrap();
        let root = dir.path();

        // Source files
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/utils.ts"), "export function util() {}").unwrap();
        fs::write(root.join("src/handler.ts"), "export function handle() {}").unwrap();
        fs::write(root.join("src/no-test.ts"), "export function orphan() {}").unwrap();

        // Test files
        fs::create_dir_all(root.join("src/tests/unit")).unwrap();
        fs::write(root.join("src/tests/unit/utils.test.ts"), "test('utils')").unwrap();
        fs::write(root.join("src/handler.spec.ts"), "test('handler')").unwrap();

        dir
    }

    #[test]
    fn test_coverage_finds_tests() {
        let dir = setup_project();
        let root = dir.path().to_str().unwrap();
        let out = dir.path().join("test-coverage.json");

        let result = run(root, "src/utils.ts\nsrc/handler.ts", out.to_str().unwrap());
        assert!(result.is_ok());
        assert!(result.unwrap().contains("2/2 files have tests"));

        let json: BTreeMap<String, CoverageEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        assert!(json["src/utils.ts"].has_tests);
        assert!(json["src/handler.ts"].has_tests);
    }

    #[test]
    fn test_coverage_no_tests() {
        let dir = setup_project();
        let root = dir.path().to_str().unwrap();
        let out = dir.path().join("test-coverage.json");

        let result = run(root, "src/no-test.ts", out.to_str().unwrap());
        assert!(result.is_ok());
        assert!(result.unwrap().contains("0/1 files have tests"));

        let json: BTreeMap<String, CoverageEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        assert!(!json["src/no-test.ts"].has_tests);
        assert!(json["src/no-test.ts"].test_files.is_empty());
    }

    #[test]
    fn test_coverage_empty_input() {
        let dir = setup_project();
        let root = dir.path().to_str().unwrap();
        let out = dir.path().join("test-coverage.json");

        let result = run(root, "", out.to_str().unwrap());
        assert!(result.is_ok());
        assert!(result.unwrap().contains("0/0"));
    }

    #[test]
    fn test_coverage_truncates_at_5() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();

        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/foo.ts"), "").unwrap();

        // Create 7 test files matching "foo"
        for i in 0..7 {
            let dir_name = format!("src/tests{}", i);
            fs::create_dir_all(root.join(&dir_name)).unwrap();
            fs::write(root.join(format!("{}/foo.test.ts", dir_name)), "").unwrap();
        }

        let out = root.join("test-coverage.json");
        run(root.to_str().unwrap(), "src/foo.ts", out.to_str().unwrap()).unwrap();

        let json: BTreeMap<String, CoverageEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        assert!(
            json["src/foo.ts"].test_files.len() <= 5,
            "should cap at 5, got {}",
            json["src/foo.ts"].test_files.len()
        );
    }

    #[test]
    fn test_coverage_excludes_node_modules() {
        // Regression test for #14: node_modules should not produce false positives
        let dir = TempDir::new().unwrap();
        let root = dir.path();

        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/utils.ts"), "").unwrap();

        // Create a test file in node_modules (should be excluded)
        fs::create_dir_all(root.join("node_modules/some-pkg")).unwrap();
        fs::write(
            root.join("node_modules/some-pkg/utils.test.ts"),
            "test('npm')",
        )
        .unwrap();

        // Create a real test file (should be included)
        fs::create_dir_all(root.join("src/tests")).unwrap();
        fs::write(root.join("src/tests/utils.test.ts"), "test('real')").unwrap();

        let out = root.join("test-coverage.json");
        run(root.to_str().unwrap(), "src/utils.ts", out.to_str().unwrap()).unwrap();

        let json: BTreeMap<String, CoverageEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        assert!(json["src/utils.ts"].has_tests);
        // Verify no node_modules paths in results
        for tf in &json["src/utils.ts"].test_files {
            assert!(
                !tf.contains("node_modules"),
                "node_modules path should be excluded: {}",
                tf
            );
        }
    }

    #[test]
    fn test_coverage_prioritizes_colocated() {
        // Regression test for #8: co-located tests should appear first
        let dir = TempDir::new().unwrap();
        let root = dir.path();

        // Source in src/api/
        fs::create_dir_all(root.join("src/api")).unwrap();
        fs::write(root.join("src/api/utils.ts"), "").unwrap();

        // Co-located test
        fs::write(root.join("src/api/utils.test.ts"), "test('colocated')").unwrap();

        // Far-away test
        fs::create_dir_all(root.join("tests/integration")).unwrap();
        fs::write(
            root.join("tests/integration/utils.test.ts"),
            "test('far')",
        )
        .unwrap();

        let out = root.join("test-coverage.json");
        run(
            root.to_str().unwrap(),
            "src/api/utils.ts",
            out.to_str().unwrap(),
        )
        .unwrap();

        let json: BTreeMap<String, CoverageEntry> =
            serde_json::from_str(&fs::read_to_string(&out).unwrap()).unwrap();
        assert!(json["src/api/utils.ts"].has_tests);
        // Co-located test should be found (it's in the same directory subtree)
        assert!(
            json["src/api/utils.ts"]
                .test_files
                .iter()
                .any(|f| f.contains("src/api/")),
            "co-located test should be found: {:?}",
            json["src/api/utils.ts"].test_files
        );
    }
}
