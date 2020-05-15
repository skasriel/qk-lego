const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  watch: false,

  watchOptions: {
    aggregateTimeout: 200,
    poll: 10000,
    ignored: [
      path.resolve(__dirname, '/public/models/'),
      path.resolve(__dirname, 'public/models/')
    ]
  },

  /*devServer: {
    watch: false,
    watchOptions: {
      ignored: [
        path.resolve(__dirname, '/public/models/'),
        path.resolve(__dirname, 'public/models/')
      ]
    },
  }*/
  
}
/*module.exports = function override(config, env) {
  console.log("WAS HERE!"); process.exit();
    if (!config.plugins) {
        config.plugins = [];
    }

    config.plugins.push(
        (process.env.NODE_ENV === 'production') ?
        new CopyWebpackPlugin([{from: 'src/lib/legacyLib.js'}]) :
        new CopyWebpackPlugin([{from: 'src/lib/legacyLib.js', to: 'dist'}])
    );

    return config;
}*/
