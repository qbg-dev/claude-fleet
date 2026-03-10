use std::io::{self, Read};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

/// Default timeout for external commands (seconds).
pub const CMD_TIMEOUT: u64 = 30;

/// Run a command with a timeout. Returns Err on timeout or spawn failure.
/// Reads stdout/stderr in background threads to prevent pipe buffer deadlock.
pub fn run_cmd(mut cmd: Command, timeout_secs: u64) -> io::Result<Output> {
    let mut child = cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;

    // Drain stdout/stderr in background threads to prevent pipe buffer deadlock
    // (git blame on large files can produce several MB of output)
    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();

    let stdout_thread = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stdout_pipe {
            pipe.read_to_end(&mut buf).ok();
        }
        buf
    });
    let stderr_thread = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stderr_pipe {
            pipe.read_to_end(&mut buf).ok();
        }
        buf
    });

    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);

    loop {
        match child.try_wait()? {
            Some(status) => {
                let stdout = stdout_thread.join().unwrap_or_default();
                let stderr = stderr_thread.join().unwrap_or_default();
                return Ok(Output {
                    status,
                    stdout,
                    stderr,
                });
            }
            None => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(io::Error::new(
                        io::ErrorKind::TimedOut,
                        format!("timed out after {}s", timeout_secs),
                    ));
                }
                thread::sleep(Duration::from_millis(50));
            }
        }
    }
}

/// Verify that required external dependencies are available.
pub fn check_deps() -> Result<(), String> {
    for dep in &["git", "grep"] {
        let status = Command::new(dep)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        match status {
            Ok(s) if s.success() => {}
            _ => return Err(format!("required dependency '{}' not found in PATH", dep)),
        }
    }
    Ok(())
}
