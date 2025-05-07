import { promises as fs, existsSync } from 'fs'
import path from 'path'
import open from 'open'
import { EventEmitter } from 'events'
import chokidar from 'chokidar'
import { startServer } from 'semo-plugin-serve'
import axios, { AxiosRequestConfig } from 'axios'

const API = axios.create()

export const disabled = false // Set to true to disable this command temporarily
export const plugin = 'markmap' // Set this for importing plugin config
export const command = 'markmap [input]'
export const desc = 'Show markdown in mindmap style.'
export const aliases = 'mm'

export const builder = function (yargs: any) {
  yargs.option('output', { describe: 'Output to a file', alias: 'o' })
  yargs.option('watch', {
    describe: 'Open in watch mode',
    type: 'boolean',
    alias: 'w',
  })
  yargs.option('open', {
    default: false,
    type: 'boolean',
    describe: 'Open in browser',
  })
}

import { Transformer } from 'markmap-lib'
import { fillTemplate } from 'markmap-render'
import { info, md5 } from '@semo/core'
import { ensureDirSync } from 'fs-extra'

const transformer = new Transformer()

function watch(input) {
  let data
  let promise
  const watcher = chokidar.watch(input).on('all', safeUpdate)
  const events = new EventEmitter()
  return {
    get,
    getChanged,
    revoke,
  }
  async function update() {
    const content = await fs.readFile(input, 'utf8')
    const result = transformer.transform(content || '')
    data = { ts: Date.now(), ...result }
    events.emit('updated')
    promise = null
  }
  function safeUpdate() {
    if (!promise) promise = update()
    return promise
  }
  async function get() {
    if (!data) await safeUpdate()
    return data
  }
  async function getChanged(ts, timeout = 10000) {
    if (data && (Number.isNaN(ts) || ts < data.ts)) return data
    try {
      await new Promise((resolve, reject) => {
        events.once('updated', resolve)
        setTimeout(() => {
          events.off('updated', resolve)
          reject()
        }, timeout)
      })
      return data
    } catch {
      return {}
    }
  }
  function revoke() {
    if (watcher) {
      watcher.close()
    }
  }
}

const renderShortcut = new Function(`\
function expandStepByStep(target) {
  let find = false
  if (target.payload?.fold && target.children && target.children.length > 0) {
    target.payload.fold = 0
    find = true
  }
  if (!find && target.children && target.children.length > 0) {
    for (const t of target.children) {
      find = expandStepByStep(t)
      if (find) {
        return find
      }
    }
  }

  return find
}

function collapseStepByStep(target) {
  let find = false

  if (target.children && target.children.length > 0) {
    const length = target.children.length
    for (let i = length - 1; i >= 0; i--) {
      const t = target.children[i]
      find = collapseStepByStep(t)
      if (find) {
        return find
      }
    }
  }

  if (!target.payload?.fold && target.children && target.children.length > 0) {
    target.payload.fold = 1
    find = true
  }
  return find
}
const focusIn = (root) => {
  if (root.children) {
    window.pointerStack.push(window.pointer)
    window.pointer = 0
    window.stack.push(root)
    root = root.children[window.pointer]
    window.root = root
    showAll(root)
    mm.setData(root)
    window.totalLevel--
    window.currentLevel = window.totalLevel - 1
  }
}

const focusOut = () => {
  if (stack.length > 0) {
    root = window.stack.pop()
    window.pointer = window.pointerStack.pop()

    window.root = root
    showAll(root)
    mm.setData(root)

    window.totalLevel++
    window.currentLevel = window.totalLevel - 1
  }
}

const focusNext = () => {
  const top = window.stack[stack.length - 1]
  if (top && top.children && pointer + 1 <= top.children.length - 1) {
    root = top.children[++pointer]
    window.root = root
    mm.setData(root)
  }
}

const focusPrevious = () => {
  const top = stack[stack.length - 1]
  if (top && top.children && pointer - 1 >= 0) {
    root = top.children[--pointer]
    window.root = root
    mm.setData(root)
  }
}

const focusReset = () => {
  root = originalRoot
  window.root = root
  stack = []
  showAll(root)
  mm.setData(root)
  totalLevel = originalTotalLevel
  currentLevel = totalLevel
}

const hideAll = (target) => {
  if (target.children && target.children.length > 0) {
    target.payload = {
      ...target.payload,
      fold: 1
    };

    target.children && target.children.forEach(t => {
      hideAll(t);
    });
  }
};

const showAll = (target) => {
  target.payload = {
    ...target.payload,
    fold: 0,
  };

  target.children && target.children.forEach(t => {
    showAll(t);
  });
};

const expandLevel = (target, level = 1) => {
  if (level <= 0) {
    return;
  }
  level--;

  target.payload = {
    ...target.payload,
    fold: 0,
  };

  target.children && target.children.forEach(t => {
    expandLevel(t, level);
  });
};

document.addEventListener(
  'keydown',
  async function (e) {
    console.log(e.keyCode)
    switch (e.keyCode) {
      case 32: // space
        mm && (await mm.fit());
        return false
      case 48: // 0
        window.currentLevel = 0
        hideAll(mm.state.data);
        await mm.setData(mm.state.data);

        return false
      case 57: // 9
        window.currentLevel = totalLevel
        showAll(mm.state.data);
        await mm.setData(mm.state.data);

        return false
      case 49: // 1
        window.currentLevel = 1
        hideAll(mm.state.data);
        expandLevel(mm.state.data, 1);
        await mm.setData(mm.state.data);

        return false
      case 50: // 2
        window.currentLevel = 2
        hideAll(mm.state.data);
        expandLevel(mm.state.data, 2);
        await mm.setData(mm.state.data);

        return false
      case 51: // 3
        window.currentLevel = 3
        hideAll(mm.state.data);
        expandLevel(mm.state.data, 3);
        await mm.setData(mm.state.data);

        return false
      case 52: // 4
        window.currentLevel = 4
        hideAll(mm.state.data);
        expandLevel(mm.state.data, 4);
        await mm.setData(mm.state.data);

        return false
      case 53: // 5
        window.currentLevel = 5
        hideAll(mm.state.data);
        expandLevel(mm.state.data, 5);
        await mm.setData(mm.state.data);

        return false
      case 187: // +
        await mm.rescale(1.25);
        return false
      case 189: // -
        await mm.rescale(0.8);
        return false

      case 70: // f
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
        return false

      case 190: { // .
        const root = window.root
        focusIn(root)
        return false
      }
      case 188: { // ,
        const root = window.root
        focusReset(root)
        return false
      }

      case 66: {
        focusOut();
        return false
      }

      case 72: // h
        hideAll(window.root)
        expandLevel(window.root, window.currentLevel > 0 ? --window.currentLevel : 0)
        await mm.setData(window.root)
        break
      case 76: // l
        hideAll(window.root)
        expandLevel(
          window.root,
          window.currentLevel < window.totalLevel - 1 ? ++window.currentLevel : window.totalLevel - 1
        )
        await mm.setData(window.root)
        break

      case 74: // j
        expandStepByStep(window.root)
        await mm.setData(window.root)
        break
      case 75: // k
        collapseStepByStep(window.root)
        await mm.setData(window.root)
        break
      case 80: // p
        focusPrevious()
        break
      case 78: // n
        focusNext()
        break
      case 191: // ?
        if (e.shiftKey) {
          document.getElementById('help-btn').click()
          return false
        }
        break
    }
  },
  false
);


`)

const renderToolbar = new Function(`\
const toolbar = new markmap.Toolbar();

toolbar.register({
  id: 'full',
  title: 'Full screen',
  content: markmap.Toolbar.icon('M5 9 v-3 h3 M5 11 v3 h3 M15 9 v-3 h-3 M15 11 v3 h-3'),
  onClick: () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  },
});
toolbar.setItems(['zoomIn', 'zoomOut', 'fit', 'full'])
toolbar.setBrand(false)
toolbar.attach(mm);
const el = toolbar.render();
el.setAttribute('style', 'position:absolute;bottom:20px;right:20px');
document.body.append(el);`)

export const handler = async function (argv: any) {
  try {
    let content
    if (argv.input) {
      if (!argv.input.startsWith('http')) {
        content = await fs.readFile(argv.input, 'utf8')
      } else {
        try {
          const config: AxiosRequestConfig = {}
          const res = await API.get(argv.input, config)
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
      output =
        argv.output || `${path.basename(argv.input.replace(/\.\w*$/, ''))}.html`
    } else if (process.env.HOME) {
      output = path.resolve(
        process.env.HOME,
        `.${argv.scriptName}/cache/semo-plugin-markmap`,
        md5(argv.input) + '.html'
      )
    } else {
      output = 'markmap.html'
    }

    const { root, features } = transformer.transform(content || '')

    const TOOLBAR_VERSION = '0.18.10'
    const TOOLBAR_CSS = `npm/markmap-toolbar@${TOOLBAR_VERSION}/dist/style.min.css`
    const TOOLBAR_JS = `npm/markmap-toolbar@${TOOLBAR_VERSION}/dist/index.min.js`
    let assets = transformer.getUsedAssets(features)

    assets = {
      styles: [
        ...(assets.styles || []),
        {
          type: 'stylesheet',
          data: {
            href: `https://cdn.jsdelivr.net/${TOOLBAR_CSS}`,
          },
        },
      ],
      scripts: [
        ...(assets.scripts || []),
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
              // @ts-ignore
              setTimeout(r, 1)
            },
            getParams: () => [renderToolbar],
          },
        },
        {
          type: 'iife',
          data: {
            fn: (r) => {
              // @ts-ignore
              setTimeout(r, 1)
            },
            getParams: () => [renderShortcut],
          },
        },
        // Add a help button on page right top corner, click will show a help modal with help info
        {
          type: 'iife',
          data: {
            fn: () => {
              const helpBtn = document.createElement('button')
              helpBtn.textContent = '❓'
              helpBtn.id = 'help-btn'
              helpBtn.style.cssText =
                'position:absolute;top:20px;right:20px;width:30px;height:30px;border-radius:50%;background:transparent;border:0;font-size:16px;cursor:pointer;z-index:1000;'
              document.body.appendChild(helpBtn)

              // 创建模态框
              const modal = document.createElement('div')
              modal.style.cssText =
                'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1001;'

              // 创建模态框内容
              const modalContent = document.createElement('div')
              modalContent.style.cssText =
                'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-color);color:var(--text-color);padding:20px;border-radius:8px;max-width:600px;width:90%;'

              // 创建表格
              const table = document.createElement('table')
              table.style.cssText = 'width:100%;border-collapse:collapse;'

              // 添加表头
              const thead = document.createElement('thead')
              thead.innerHTML =
                '<tr style="border-bottom:2px solid #ddd;"><th style="padding:10px;text-align:left;width:200px;">快捷键 / Shortcut</th><th style="padding:10px;text-align:left;">功能描述 / Description</th></tr>'
              table.appendChild(thead)

              // 添加表格内容
              const tbody = document.createElement('tbody')
              const shortcuts = [
                ['0-5', '设置思维导图层级 / Set mindmap level'],
                ['9', '展开全部 / Expand all'],
                ['0', '折叠全部 / Collapse all'],
                ['.', '聚焦进入 / Focus in'],
                [',', '聚焦退出 / Focus out'],
                ['b', '重置显示全部 / Reset to show all'],
                ['p', '聚焦上一个 / Focus previous'],
                ['n', '聚焦下一个 / Focus next'],
                ['h', '收起到上一层级 / Collapse to previous level'],
                ['l', '展开到下一层级 / Expand to next level'],
                ['j', '逐步展开 / Expand step by step'],
                ['k', '逐步收起 / Collapse step by step'],
                ['f', '全屏 / Full screen'],
                ['+', '放大 / Zoom in'],
                ['-', '缩小 / Zoom out'],
                ['空格 / Space', '适应屏幕 / Fit to screen'],
              ]

              shortcuts.forEach(([key, desc]) => {
                const tr = document.createElement('tr')
                tr.style.cssText = 'border-bottom:1px solid #eee;'
                tr.innerHTML = `<td style="padding:10px;">${key}</td><td style="padding:10px;">${desc}</td>`
                tbody.appendChild(tr)
              })

              table.appendChild(tbody)
              modalContent.appendChild(table)
              modal.appendChild(modalContent)
              document.body.appendChild(modal)

              // 添加关闭按钮
              const closeBtn = document.createElement('button')
              closeBtn.textContent = '✖️'
              closeBtn.style.cssText =
                'position:absolute;top:20px;right:20px;border:none;background:none;font-size:20px;cursor:pointer;'
              modalContent.appendChild(closeBtn)

              // 绑定事件
              helpBtn.onclick = () => (modal.style.display = 'block')
              closeBtn.onclick = () => (modal.style.display = 'none')
              modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none'
              }
            },
            getParams: () => [],
          },
        },
        // Add a switch button on page right top corner, click will switch between dark and light theme
        {
          type: 'iife',
          data: {
            fn: () => {
              // Create theme switch button
              const themeBtn = document.createElement('button')
              themeBtn.id = 'theme-btn'
              themeBtn.innerHTML = '☀️'
              themeBtn.style.cssText =
                'position:absolute;top:20px;right:60px;width:30px;height:30px;background:transparent;border:0;font-size:16px;cursor:pointer;z-index:1000;display:flex;align-items:center;justify-content:center;'
              document.body.appendChild(themeBtn)

              // Add CSS variables for themes
              const style = document.createElement('style')
              style.textContent = `
                :root {
                  --bg-color: #ffffff;
                  --text-color: #333333;
                  --link-color: #0969da;
                  --border-color: #cccccc;
                }
                :root[data-theme='dark'] {
                  --bg-color: #1a1a1a;
                  --text-color: #ccc;
                  --link-color: #58a6ff;
                  --border-color: #404040;
                }
                body {
                  background-color: var(--bg-color);
                  color: var(--text-color);
                }
                #mindmap {
                  background-color: var(--bg-color);
                  color: var(--text-color);
                }
                .markmap-wrapper {
                  background-color: var(--bg-color);
                }
                .markmap-node > g > circle {
                  stroke: var(--border-color);
                }
                .markmap-node > g > text {
                  fill: var(--text-color);
                }
                .markmap-link {
                  stroke: var(--border-color);
                }
                .toolbar {
                  background-color: var(--bg-color) !important;
                  border-color: var(--border-color) !important;
                }
                .toolbar button {
                  color: var(--text-color) !important;
                }
                #help-btn, #theme-btn {
                  background: var(--bg-color);
                  border-color: var(--border-color);
                  color: var(--text-color);
                }
                .modal-content {
                  background: var(--bg-color);
                  color: var(--text-color);
                }
                .modal-content table th, .modal-content table td {
                  border-color: var(--border-color);
                }
              `
              document.head.appendChild(style)

              // Initialize theme from localStorage or system preference
              const prefersDark = window.matchMedia(
                '(prefers-color-scheme: dark)'
              )
              const savedTheme = localStorage.getItem('theme')
              const isDark =
                savedTheme === 'dark' || (!savedTheme && prefersDark.matches)
              document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
              themeBtn.innerHTML = isDark ? '🌙' : '☀️'

              // Toggle theme on button click
              themeBtn.onclick = () => {
                const isDark = document.documentElement.dataset.theme === 'dark'
                document.documentElement.dataset.theme = isDark
                  ? 'light'
                  : 'dark'
                themeBtn.innerHTML = isDark ? '☀️' : '🌙'
                localStorage.setItem('theme', isDark ? 'light' : 'dark')
              }

              // Listen for system theme changes
              prefersDark.addEventListener('change', (e) => {
                if (!localStorage.getItem('theme')) {
                  document.documentElement.dataset.theme = e.matches
                    ? 'dark'
                    : 'light'
                  themeBtn.innerHTML = e.matches ? '🌙' : '☀️'
                }
              })
            },
          },
        },
      ],
    }

    let html = fillTemplate(root, assets)

    if (
      argv.watch &&
      argv.input &&
      !argv.input.startsWith('http') &&
      existsSync(argv.input)
    ) {
      // add watcher
      html += `<script>
      {
        let ts = 0;

        window.stack = []
        window.pointerStack = []
        window.pointer = null
        window.currentLevel = 0
        window.totalLevel = 0
        window.originalRoot = null
        window.originalTotalLevel = 0

        function maxDepth(obj) {
            return obj.children && obj.children.length > 0
                ? 1 + Math.max(...obj.children.map(maxDepth))
                : 1;
        }


        function refresh() {
          fetch(\`/data?ts=\${ts}\`).then(res => res.json()).then(res => {
            if (res.ts && res.ts > ts) {
              ts = res.ts;
              window.root = res.root
              window.totalLevel = maxDepth(res.root)
              window.originalTotalLevel = totalLevel
              window.currentLevel = totalLevel - 1
              window.originalRoot = res.root
              mm.setData(res.root, {
                pan: true,
                maxWidth: 400
              });
              mm.fit();
            }
            setTimeout(refresh, 300);
          });
        }
        refresh();
      }
      </script>`

      const watcher = watch(argv.input)
      argv.addRoutes = await startServer({
        openBrowser: argv.open,
        addRoutes: (router) => {
          router.get('/', (ctx) => {
            ctx.body = html
          })

          router.get('/data', async (ctx) => {
            ctx.body = await watcher.getChanged(ctx.query.ts)
          })
        },
      })
      return false
    } else {
      ensureDirSync(path.dirname(output))
      await fs.writeFile(output, html, 'utf8')
      info(`Markmap output: ${output}`)
      if (argv.open) open(output)
    }
  } catch (e) {
    console.log(e)
  }
  return true
}
