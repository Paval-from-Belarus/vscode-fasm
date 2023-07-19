
'use strict';
const path = require('path');

module.exports = {
  entry: './src/main.js',
  devtool: 'source-map',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
  output: {
    filename: 'extension.js',
    path: path.resolve(__dirname, 'out'),
  },
};