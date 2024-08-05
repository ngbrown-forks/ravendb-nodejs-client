import { defineConfig, Options } from "tsup";

export default defineConfig(options => {
	const commonOptions: Partial<Options> = {
		entry: {
			ravendb: "src/index.ts"
		},
		external: [/node:.*/],
		dts: true,
		clean: true,
		sourcemap: true,
		...options
	}

	const productionOptions = {
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
			outDir: "./dist/"
		},
		// CJS
		{
			...commonOptions,
			...productionOptions,
			format: "cjs",
			outDir: "./dist/cjs/"
		}
	]
})
