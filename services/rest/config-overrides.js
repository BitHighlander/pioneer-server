const webpack = require('webpack');

module.exports = function override(config) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        // "os": require.resolve("os-browserify"),
        // "url": require.resolve("url"),
        // "net": require.resolve("net"),
        // "zlib": require.resolve("zlib"),
        "zlib": require.resolve("browserify-zlib"),
        // "path": require.resolve("path"),
        // "tls": require.resolve("tls"),
        //@jsdevtools
        fs: false
    })
    config.resolve.fallback = fallback;
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ])
    return config;
}