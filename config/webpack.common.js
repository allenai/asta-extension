const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const buildConfig = require('./build-config')

// Get build target from environment (default to 'public')
const target = process.env.TARGET || 'public'
const config = buildConfig[target]

if (!config) {
  throw new Error(`Unknown TARGET: ${target}. Must be 'public' or 'internal'`)
}

console.log(`Building for target: ${target} (${config.ASTA_UI_URL})`)

module.exports = {
  entry: {
    index: './src/index.js',
    background: './src/background.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '..', 'extension')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'swc-loader'
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]___[hash:base64:5]'
              },
              importLoaders: 1
            }
          },
          'postcss-loader'
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'styles.css'
    }),
    new webpack.DefinePlugin({
      'process.env.ASTA_UI_URL': JSON.stringify(config.ASTA_UI_URL)
    })
  ]
}
