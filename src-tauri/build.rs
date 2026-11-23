fn main() {
    #[cfg(target_os = "macos")]
    compile_apple_foundation_models_bridge();

    tauri_build::build()
}

#[cfg(target_os = "macos")]
fn compile_apple_foundation_models_bridge() {
    use std::env;
    use std::path::PathBuf;
    use std::process::Command;

    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    // Apple Intelligence / FoundationModels only runs on Apple Silicon (arm64).
    // Skipping Swift bridge compilation on x86_64 also keeps macOS universal builds clean
    // when newer macOS Command Line Tools drop x86_64 slices from Swift compatibility archives.
    if target_os != "macos" || target_arch != "aarch64" {
        return;
    }

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let swift_src = manifest_dir.join("swift").join("apple_foundation_models.swift");
    println!("cargo:rerun-if-changed={}", swift_src.display());
    println!("cargo:rerun-if-env-changed=MACOSX_DEPLOYMENT_TARGET");

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let static_lib = out_dir.join("libapple_foundation_models.a");

    let arch = "arm64";
    let deployment_target =
        env::var("MACOSX_DEPLOYMENT_TARGET").unwrap_or_else(|_| "10.15".to_string());
    let swift_target = format!("{}-apple-macos{}", arch, deployment_target);

    let sdk_path = Command::new("xcrun")
        .args(["--show-sdk-path"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    let mut cmd = Command::new("swiftc");
    cmd.args([
        "-parse-as-library",
        "-O",
        "-target",
        &swift_target,
        "-emit-library",
        "-static",
        "-o",
    ])
    .arg(&static_lib)
    .arg(&swift_src);

    if let Some(ref sdk) = sdk_path {
        cmd.args(["-sdk", sdk]);
    }

    let output = cmd
        .output()
        .expect("Failed to execute swiftc to compile Apple Foundation Models bridge");
    if !output.status.success() {
        panic!(
            "swiftc failed for target {}:\nstdout: {}\nstderr: {}",
            swift_target,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static=apple_foundation_models");

    // Add Swift runtime library search paths reported by swiftc
    if let Ok(info_out) = Command::new("swiftc")
        .args(["-target", &swift_target, "-print-target-info"])
        .output()
    {
        if info_out.status.success() {
            let text = String::from_utf8_lossy(&info_out.stdout);
            // Extract runtimeLibraryPaths entries from JSON without extra build-dependencies
            if let Some(start) = text.find("\"runtimeLibraryPaths\"") {
                if let Some(arr_start) = text[start..].find('[') {
                    let rest = &text[start + arr_start + 1..];
                    if let Some(arr_end) = rest.find(']') {
                        for segment in rest[..arr_end].split(',') {
                            let path = segment.trim().trim_matches('"').trim();
                            if !path.is_empty() && PathBuf::from(path).is_dir() {
                                println!("cargo:rustc-link-search=native={}", path);
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(ref sdk) = sdk_path {
        let sdk_swift_lib = PathBuf::from(sdk).join("usr/lib/swift");
        if sdk_swift_lib.is_dir() {
            println!("cargo:rustc-link-search=native={}", sdk_swift_lib.display());
        }
        let fm_framework = PathBuf::from(sdk)
            .join("System/Library/Frameworks/FoundationModels.framework");
        if fm_framework.exists() {
            // Weak-link FoundationModels so the universal binary still launches on macOS 10.15 - 15.x
            println!("cargo:rustc-link-arg=-Wl,-weak_framework,FoundationModels");
        }
    }

    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
}
