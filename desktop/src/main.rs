// The IDS Workshop in a window of its own. The page is the workshop's build, the sans composer
// export ships in the app's resources and is served under the `atlas` scheme, and every address
// outside the app opens in the system's browser.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::http::{header, Request, Response, StatusCode};
use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{Manager, Url, WebviewUrl, WebviewWindowBuilder};

/// Whether the address belongs to the app: its own pages, the export, and what a page makes for
/// itself (a blob to download, a data URL). The dev server is a localhost address.
fn inside(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "atlas" | "blob" | "data" | "about" => true,
        "http" | "https" => matches!(url.host_str(), Some(host) if host == "localhost" || host.ends_with(".localhost") || host == "127.0.0.1"),
        _ => false,
    }
}

/// A file of the export by its name in the export (`manifest.json`, `g/07/07a3.json`): only plain
/// names below the export's folder are read.
fn export_file(root: &Path, name: &str) -> Option<PathBuf> {
    let name = name.trim_start_matches('/');
    let plain = !name.is_empty()
        && name.split('/').all(|part| !part.is_empty() && part != "." && part != "..")
        && name.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'/' | b'-' | b'_'));
    plain.then(|| root.join(name))
}

fn atlas(root: Option<PathBuf>, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let answer = |status: StatusCode, body: Vec<u8>| {
        Response::builder()
            .status(status)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(header::CONTENT_TYPE, "application/octet-stream")
            .body(body)
            .unwrap()
    };
    let Some(path) = root.and_then(|root| export_file(&root, request.uri().path())) else {
        return answer(StatusCode::NOT_FOUND, Vec::new());
    };
    match std::fs::read(path) {
        Ok(bytes) => answer(StatusCode::OK, bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => answer(StatusCode::NOT_FOUND, Vec::new()),
        Err(_) => answer(StatusCode::INTERNAL_SERVER_ERROR, Vec::new()),
    }
}

/// Where a portable copy keeps its webview data (settings, tabs, recent parts): a `data` folder
/// beside the executable, when a file named `portable` sits there. An installed copy has no such
/// file and keeps the webview's own place in the user's profile.
fn portable_data(exe: &Path) -> Option<PathBuf> {
    let dir = exe.parent()?;
    dir.join("portable").is_file().then(|| dir.join("data"))
}

fn open_outside(url: &Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
    }
}

fn main() {
    tauri::Builder::default()
        .register_asynchronous_uri_scheme_protocol("atlas", |context, request, responder| {
            let root = context.app_handle().path().resource_dir().ok().map(|dir| dir.join("atlas"));
            std::thread::spawn(move || responder.respond(atlas(root, &request)));
        })
        .setup(|app| {
            let mut window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()));
            if let Some(data) = std::env::current_exe().ok().and_then(|exe| portable_data(&exe)) {
                window = window.data_directory(data);
            }
            window
                .title("IDS Workshop")
                .inner_size(1360.0, 860.0)
                .min_inner_size(360.0, 480.0)
                .on_navigation(|url| {
                    if inside(url) {
                        return true;
                    }
                    open_outside(url);
                    false
                })
                .on_new_window(|url, _| {
                    open_outside(&url);
                    NewWindowResponse::Deny
                })
                // A download lands in the Downloads folder under the name the page gave it, and the
                // folder opens on it once it is written. WebKit on macOS reports no path when a
                // download finishes, so the destination is kept from the request.
                .on_download({
                    let destinations = Mutex::new(HashMap::<String, PathBuf>::new());
                    move |_, event| {
                        match event {
                            DownloadEvent::Requested { url, destination } => {
                                destinations.lock().unwrap().insert(url.to_string(), destination.clone());
                            }
                            DownloadEvent::Finished { url, path, success } => {
                                let kept = destinations.lock().unwrap().remove(url.as_str());
                                if let (true, Some(path)) = (success, path.or(kept)) {
                                    let _ = tauri_plugin_opener::reveal_item_in_dir(path);
                                }
                            }
                            _ => {}
                        }
                        true
                    }
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("the IDS Workshop could not start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_only_names_below_the_export() {
        let root = Path::new("/export");
        assert_eq!(export_file(root, "/g/07/07a3.json"), Some(root.join("g/07/07a3.json")));
        assert_eq!(export_file(root, "/p/07a.json"), Some(root.join("p/07a.json")));
        assert_eq!(export_file(root, "/manifest.json"), Some(root.join("manifest.json")));
        assert_eq!(export_file(root, "/../secret"), None);
        assert_eq!(export_file(root, "/g/../../secret"), None);
        assert_eq!(export_file(root, "/g//07a.json"), None);
        assert_eq!(export_file(root, "/"), None);
        assert_eq!(export_file(root, "/g/%2e%2e"), None);
    }

    #[test]
    fn keeps_portable_data_beside_the_executable() {
        let dir = std::env::temp_dir().join(format!("ids-workshop-portable-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("ids-workshop.exe");
        assert_eq!(portable_data(&exe), None);
        std::fs::write(dir.join("portable"), "").unwrap();
        assert_eq!(portable_data(&exe), Some(dir.join("data")));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn keeps_the_app_inside_and_sends_the_web_out() {
        for inside_url in ["tauri://localhost/index.html", "http://tauri.localhost/", "atlas://localhost/manifest.json", "blob:tauri://localhost/x", "http://localhost:5173/"] {
            assert!(inside(&Url::parse(inside_url).unwrap()), "{inside_url}");
        }
        for outside_url in ["https://ids.mkpo.li/", "https://github.com/mkpoli/ids-input", "mailto:someone@example.org", "http://localhost.example.org/"] {
            assert!(!inside(&Url::parse(outside_url).unwrap()), "{outside_url}");
        }
    }
}
