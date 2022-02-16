const path = require("path");
const { execSync } = require("child_process");

const DIST_NAME = "extent";

const relDir = (...pathFrags)=>path.resolve(__dirname, ...pathFrags);

const hasShaderFiles = ()=>{
  const rv = execSync(`find ${relDir("src")} -type f -name '*.glsl'`);
  return rv.stdout && rv.stdout.trim().length > 0;
}

const webpackConfig = (prod)=>{
  const rules = [
    {
      test: /\.(js|ts|tsx?)$/,
      exclude: /node_modules/,
      use: ["babel-loader", {
        loader: "ts-loader",
        options: {
          configFile: prod ? "tsconfig.prod.json" : "tsconfig.json",
          compilerOptions: {
            sourceMap: prod
          }
        }
      }]
    },
  ];
  const extensions = [".js", ".ts", ".tsx"];

  if (hasShaderFiles()) {
    rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ["ts-shader-loader"],
    });
    extensions.push(".glsl");
  }

  return {
    output: {
      path: relDir(prod ? "dist-prod" : "dist", "src"),
      globalObject: "this",
      library: `parsegraph_${DIST_NAME}`,
      libraryTarget: "umd",
    },
    module: {
      rules
    },
    resolve: {
      extensions,
      modules: [relDir("src"), relDir("node_modules")]
    },
    mode: prod ? "production" : "development",
    devtool: prod ? false : "eval-source-map",
  };
};

module.exports = {
  DIST_NAME,
  relDir,
  webpackConfig
};
