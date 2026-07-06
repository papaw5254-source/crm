const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('child_process')
const http = require('http')
const path = require('path')

const PORT = process.env.CRM_DESKTOP_PORT || '3137'
const APP_URL = `http://127.0.0.1:${PORT}`
let nextProcess = null

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })

      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('CRM oynasini ishga tushirish uchun server javob bermadi.'))
          return
        }
        setTimeout(check, 500)
      })

      req.setTimeout(2000, () => {
        req.destroy()
      })
    }

    check()
  })
}

function startNextServer() {
  const appPath = app.getAppPath()
  const nextBin = require.resolve('next/dist/bin/next')

  nextProcess = spawn(
    process.execPath,
    [nextBin, 'start', '--hostname', '127.0.0.1', '--port', PORT],
    {
      cwd: appPath,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://185.191.141.138/api',
      },
      stdio: 'ignore',
      windowsHide: true,
    },
  )

  nextProcess.on('exit', () => {
    nextProcess = null
  })
}

async function createWindow() {
  startNextServer()

  try {
    await waitForServer(APP_URL)
  } catch (error) {
    dialog.showErrorBox('Gisht Zavodi CRM', error.message)
    app.quit()
    return
  }

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'Gisht Zavodi CRM',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  mainWindow.setMenuBarVisibility(false)
  await mainWindow.loadURL(APP_URL)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
