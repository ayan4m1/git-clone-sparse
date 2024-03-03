import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import autoExternal from 'rollup-plugin-auto-external';

const plugins = [autoExternal(), typescript(), nodeResolve()];

if (process.env.NODE_ENV === 'production') {
  plugins.push(terser());
}

export default {
  input: './src/index.ts',
  output: {
    file: './lib/index.js',
    format: 'esm'
  },
  plugins
};
