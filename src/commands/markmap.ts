import { promises as fs, existsSync } from 'fs'
import path from 'path'
import open from 'open'
import { EventEmitter } from 'events'
import chokidar from 'chokidar'
import { UtilsType } from '@semo/core'
import { startServer } from 'semo-plugin-serve'
import axios, { AxiosRequestConfig } from 'axios'

const API = axios.create()

export const disabled = false // Set to true to disable this command temporarily
export const plugin = 'markmap' // Set this for importing plugin config
export const command = 'markmap [input]'
export const desc = 'Show markdown in mindmap style.'
export const aliases = 'mm'
// export const middleware = (argv) => {}

import {
  transform, getUsedAssets, fillTemplate,
} from 'markmap-lib'


function watch(input) {
  let data;
  let promise;
  let watcher = chokidar.watch(input).on('all', safeUpdate);
  const events = new EventEmitter();
  return {
    get,
    getChanged,
    revoke,
  };
  async function update() {
    const content = await fs.readFile(input, 'utf8');
    const result = transform(content || '');
    data = { ts: Date.now(), ...result };
    events.emit('updated');
    promise = null;
  }
  function safeUpdate() {
    if (!promise) promise = update();
    return promise;
  }
  async function get() {
    if (!data) await safeUpdate();
    return data;
  }
  async function getChanged(ts, timeout = 10000) {
    if (data && (Number.isNaN(ts) || ts < data.ts)) return data;
    try {
      await new Promise((resolve, reject) => {
        events.once('updated', resolve);
        setTimeout(() => {
          events.off('updated', resolve);
          reject();
        }, timeout);
      });
      return data;
    } catch {
      return {};
    }
  }
  function revoke() {
    if (watcher) {
      watcher.close();
    }
  }
}

const renderToolbar = new Function(`\
const toolbar = new markmap.Toolbar();
toolbar.setItems(['zoomIn', 'zoomOut', 'fit', 'full'])
toolbar.register({
  id: 'full',
  title: 'Full screen',
  content: markmap.Toolbar.icon('M5 9 v-3 h3 M5 11 v3 h3 M15 9 v-3 h-3 M15 11 v3 h-3'),
  onClick: () => {
    document.querySelector("#mindmap").requestFullscreen();
  },
});
toolbar.setBrand(false)
toolbar.attach(mm);
const el = toolbar.render();
el.setAttribute('style', 'position:absolute;bottom:20px;right:20px');
document.body.append(el);`);

export const builder = function (yargs: any) {
  yargs.option('output', { describe: 'Output to a file' })
  yargs.option('watch', { describe: 'Open in watch mode', alias: 'w' })
  yargs.option('open', { default: true, describe: 'Open in browser' })
}

export const handler = async function (argv: any) {
  const Utils:UtilsType = argv.$semo.Utils
  
  try {
    let content
    if (argv.input) {
      if (!argv.input.startsWith('http')) {
        content = await fs.readFile(argv.input, 'utf8')
      } else {
        try {
          let config: AxiosRequestConfig = {}
          let res = await API.get(argv.input, config)
          content = res.data || ''
        } catch (e) {
          throw new Error(e.message)
        }
      }
    } else if (argv.$input) {
      content = argv.$input
      argv.input = 'pipe-input'
    }

    let output
    if (argv.output) {
      output = argv.output || `${path.basename(argv.input.replace(/\.\w*$/, ''))}.html`
    } else if (process.env.HOME) {
      output = path.resolve(process.env.HOME, `.${argv.scriptName}/cache/semo-plugin-markmap`, Utils.md5(argv.input) + '.html')
    } else {
      output = 'markmap.html'
    }

    const { root, features } = transform(content || '')

    const TOOLBAR_VERSION = '0.1.3'
    const TOOLBAR_CSS = `npm/markmap-toolbar@${TOOLBAR_VERSION}/dist/style.min.css`
    const TOOLBAR_JS = `npm/markmap-toolbar@${TOOLBAR_VERSION}/dist/index.umd.min.js`
    let assets = getUsedAssets(features)

    assets = {
      styles: [
        ...assets.styles || [],
        {
          type: 'stylesheet',
          data: {
            href: `https://cdn.jsdelivr.net/${TOOLBAR_CSS}`,
          },
        },
      ],
      scripts: [
        ...assets.scripts || [],
        {
          type: 'script',
          data: {
            src: `https://cdn.jsdelivr.net/${TOOLBAR_JS}`,
          },
        },
        {
          type: 'iife',
          data: {
            fn: (r) => {
              setTimeout(r, 1);
            },
            getParams: () => [renderToolbar],
          },
        },
      ],
    };

    let html = fillTemplate(root, assets)
    
    if (argv.watch && argv.input && !argv.input.startsWith('http') && existsSync(argv.input)) {
      // add watcher
      html += `<script>
      {
        let ts = 0;
        function refresh() {
          fetch(\`/data?ts=\${ts}\`).then(res => res.json()).then(res => {
            if (res.ts && res.ts > ts) {
              ts = res.ts;
              mm.setData(res.root);
              mm.fit();
            }
            setTimeout(refresh, 300);
          });
        }
        refresh();
      }
      </script>`


      argv.openBrowser = true
      const watcher = watch(argv.input);
      argv.addRoutes = (router) => {
        router.get('/', (ctx, next) => {
          ctx.body = html
        })

        router.get('/data', async (ctx, next) => {
          ctx.body = await watcher.getChanged(ctx.query.ts)
        })
      }
      await startServer(argv)
      return false
    } else {
      Utils.fs.ensureDirSync(path.dirname(output))
      await fs.writeFile(output, html, 'utf8')
      if (argv.open) open(output)

    }

  } catch (e) {
    console.log(e)
  }
  return true
}
