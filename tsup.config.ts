import { defineConfig, Options } from "tsup";

export default defineConfig(options => {
	const commonOptions: Partial<Options> = {
		entry: {
			ravendb: "src/index.ts"
		},
		sourcemap: true,
		...options
	}

	const productionOptions = {
		minify: true,
		esbuildOptions(options, _context) {
			options.mangleProps = /_$/
		},
		define: {
			"process.env.NODE_ENV": JSON.stringify("production")
		}
	}

	return [
		// ESM, standard bundler
		{
			...commonOptions,
			...productionOptions,
			format: ["esm"],
			dts: true,
			clean: true,
			sourcemap: true
		},
		// CJS
		{
			...commonOptions,
			...productionOptions,
			entry: {
				"ravendb": "src/index.ts"
			},
			format: "cjs",
			outDir: "./dist/cjs/"
		}
	]
})
