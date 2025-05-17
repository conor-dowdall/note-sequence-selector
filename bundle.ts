import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";

async function bundle() {
  try {
    const result = await esbuild.build({
      plugins: [...denoPlugins()],
      entryPoints: ["./src/mod.ts"],
      outfile: "./dist/bundle.js",
      bundle: true,
      minify: true,
      sourcemap: true,
      format: "esm",
      platform: "browser",
    });

    console.log(result, "\n");
    console.log("🟢 Bundling complete: created dist/bundle.js");
  } catch (error) {
    console.error("🔴 Bundling failed:", error);
  } finally {
    await esbuild.stop();
  }
}

bundle();
