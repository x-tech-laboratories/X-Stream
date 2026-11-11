{ lib, buildNpmPackage, nodejs_24 }:

buildNpmPackage rec {
  pname = "x-stream";
  version = "0.2.1";

  src = ./.;
  nodejs = nodejs_24;

  # The build never starts Electron, so its binary is not downloaded.
  env.ELECTRON_SKIP_BINARY_DOWNLOAD = "1";

  # After a lock file change, refresh with `nix run nixpkgs#prefetch-npm-deps -- package-lock.json`.
  npmDepsHash = "sha256-Gdn/axDeQv71dSvf6BL5Y/PwOY3vMJ7JSctrSQyUBgk=";

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
