mod blame_context;
mod dep_graph;
mod shuffle;
mod test_coverage;
pub mod util;

use std::env;
use std::process::ExitCode;

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        return ExitCode::from(1);
    }

    match args[1].as_str() {
        "--help" | "-h" => {
            print_usage();
            return ExitCode::SUCCESS;
        }
        "--version" | "-V" => {
            println!("dr-context {}", VERSION);
            return ExitCode::SUCCESS;
        }
        _ => {}
    }

    // Validate external dependencies before dispatching
    if let Err(e) = util::check_deps() {
        eprintln!("Error: {}", e);
        return ExitCode::from(1);
    }

    let result = match args[1].as_str() {
        "dep-graph" => {
            if args.len() != 5 {
                eprintln!("Usage: dr-context dep-graph <project_root> <changed_files_newline_sep> <output_path>");
                return ExitCode::from(1);
            }
            dep_graph::run(&args[2], &args[3], &args[4])
        }
        "test-coverage" => {
            if args.len() != 5 {
                eprintln!("Usage: dr-context test-coverage <project_root> <changed_files_newline_sep> <output_path>");
                return ExitCode::from(1);
            }
            test_coverage::run(&args[2], &args[3], &args[4])
        }
        "blame-context" => {
            if args.len() < 5 || args.len() > 6 {
                eprintln!("Usage: dr-context blame-context <project_root> <material_file> <output_path> [base_ref]");
                return ExitCode::from(1);
            }
            let base_ref = args.get(5).map(|s| s.as_str());
            blame_context::run(&args[2], &args[3], &args[4], base_ref)
        }
        "shuffle" => {
            if args.len() != 5 {
                eprintln!("Usage: dr-context shuffle <material_file> <session_dir> <num_workers>");
                return ExitCode::from(1);
            }
            shuffle::run(&args[2], &args[3], &args[4])
        }
        _ => {
            eprintln!("Unknown subcommand: {}", args[1]);
            eprintln!();
            print_usage();
            Err("unknown subcommand".into())
        }
    };

    match result {
        Ok(msg) => {
            println!("{}", msg);
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("Error: {}", e);
            ExitCode::from(1)
        }
    }
}

fn print_usage() {
    eprintln!("dr-context {} — context analysis for deep review", VERSION);
    eprintln!();
    eprintln!("Usage: dr-context <subcommand> [args...]");
    eprintln!();
    eprintln!("Subcommands:");
    eprintln!("  dep-graph       Build dependency graph for changed files");
    eprintln!("  test-coverage   Find test files for changed files");
    eprintln!("  blame-context   Classify lines as new vs pre-existing via git blame");
    eprintln!("  shuffle         Split material into shuffled worker chunks");
    eprintln!();
    eprintln!("Flags:");
    eprintln!("  --help, -h      Show this help");
    eprintln!("  --version, -V   Show version");
}
