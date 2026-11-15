{ lib, buildNpmPackage, importNpmLock, nodejs_24 }:

buildNpmPackage rec {
  pname = "x-stream";
  version = "0.2.1";

  src = ./.;
  nodejs = nodejs_24;

  # The build never starts Electron, so its binary is not downloaded.
  env.ELECTRON_SKIP_BINARY_DOWNLOAD = "1";

  # Read from package-lock.json, so there is no deps hash to keep in step with it.
  npmDeps = importNpmLock { npmRoot = ./.; };
  npmConfigHook = importNpmLock.npmConfigHook;

  # electron-vite writes the main process, preload and page into out/
  installPhase = ''
    runHook preInstall
    cp -r out $out
    runHook postInstall
  '';

  meta = with lib; {
    description = "A free, open source, privacy-respecting YouTube client";
    license = licenses.gpl3Plus;
    platforms = platforms.all;
    mainProgram = "x-stream";
  };
}
