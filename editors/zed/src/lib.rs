use std::{env, fs};

use zed_extension_api::{self as zed, LanguageServerId, Result, serde_json, settings::LspSettings};

const LANGUAGE_SERVER_ID: &str = "jsonl-lsp";
const PACKAGE_NAME: &str = "@sarvagnan/jsonl-lsp";
const SERVER_PATH: &str = "node_modules/@sarvagnan/jsonl-lsp/bin/jsonl-lsp.js";

struct JsonlToolsExtension {
    cached_server_path: Option<String>,
}

impl JsonlToolsExtension {
    fn server_exists() -> bool {
        fs::metadata(SERVER_PATH).is_ok_and(|metadata| metadata.is_file())
    }

    fn server_script_path(&mut self, language_server_id: &LanguageServerId) -> Result<String> {
        if let Some(path) = self
            .cached_server_path
            .as_ref()
            .filter(|_| Self::server_exists())
        {
            return Ok(path.clone());
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        //	an existing install keeps working when the registry is unreachable
        match zed::npm_package_latest_version(PACKAGE_NAME) {
            Ok(latest_version) => {
                let installed_version = zed::npm_package_installed_version(PACKAGE_NAME)
                    .ok()
                    .flatten();

                if !Self::server_exists() || installed_version.as_ref() != Some(&latest_version) {
                    zed::set_language_server_installation_status(
                        language_server_id,
                        &zed::LanguageServerInstallationStatus::Downloading,
                    );
                    zed::npm_install_package(PACKAGE_NAME, &latest_version).map_err(|error| {
                        format!("failed to install {PACKAGE_NAME}@{latest_version}: {error}")
                    })?;
                }
            }
            Err(error) => {
                if !Self::server_exists() {
                    return Err(format!(
                        "failed to find the latest {PACKAGE_NAME} version: {error}"
                    ));
                }
            }
        }

        if !Self::server_exists() {
            return Err(format!(
                "installed package '{PACKAGE_NAME}' did not contain expected server script '{SERVER_PATH}'"
            ));
        }

        let server_path = env::current_dir()
            .map_err(|error| format!("failed to resolve the extension working directory: {error}"))?
            .join(SERVER_PATH)
            .to_string_lossy()
            .into_owned();
        self.cached_server_path = Some(server_path.clone());
        Ok(server_path)
    }
}

impl zed::Extension for JsonlToolsExtension {
    fn new() -> Self {
        Self {
            cached_server_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        if language_server_id.as_ref() != LANGUAGE_SERVER_ID {
            return Err(format!(
                "unsupported language server id: {language_server_id}"
            ));
        }

        if let Some(command) = worktree.which(LANGUAGE_SERVER_ID) {
            return Ok(zed::Command {
                command,
                args: vec!["--stdio".to_string()],
                env: Default::default(),
            });
        }

        let server_path = self.server_script_path(language_server_id)?;
        Ok(zed::Command {
            command: zed::node_binary_path()
                .map_err(|error| format!("failed to locate Zed's Node.js binary: {error}"))?,
            args: vec![server_path, "--stdio".to_string()],
            env: Default::default(),
        })
    }

    //	forwards `lsp.jsonl-lsp.initialization_options` from Zed settings so
    //	users can configure the server (e.g. jsonl.allowBlankLines)
    fn language_server_initialization_options(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        Ok(LspSettings::for_worktree(language_server_id.as_ref(), worktree)
            .ok()
            .and_then(|settings| settings.initialization_options))
    }
}

zed::register_extension!(JsonlToolsExtension);
