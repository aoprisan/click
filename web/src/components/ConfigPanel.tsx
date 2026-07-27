// Live game-data console: upload the design CSVs, play them immediately, hand
// the build back to the designer. No backend and no rebuild — the browser parses
// the files (game/catalogBuild.ts) and the whole catalog is swapped in place.
//
// Every apply restarts the world, because the cities in memory were built from
// the old tech tree (ids, prices and worker counts all move). That is the reset
// button too: "Reset game data" is the same path with the config left alone.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BUILT_IN_SOURCE, CONFIG_FILES, activeConfig, applyConfig, configSummary, message,
  resetConfig, type ConfigFileKey, type GameConfig,
} from '../game/config'
import { recipeOverrideProblems } from '../game/catalog'

interface Props {
  onClose: () => void
  onResetGame: () => void
}

type Status = { tone: 'good' | 'warn'; text: string } | null

function lineCount(text: string): number {
  return text.split('\n').filter(l => l.trim() !== '').length
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ConfigPanel({ onClose, onResetGame }: Props) {
  const [config, setConfig] = useState<GameConfig>(activeConfig)
  const [status, setStatus] = useState<Status>(null)
  const [pasting, setPasting] = useState<ConfigFileKey | null>(null)
  const [draft, setDraft] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingKey = useRef<ConfigFileKey | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const summary = useMemo(() => configSummary(config), [config])
  // The overlay's amounts can name ingredients the tree doesn't have — worth
  // showing next to the CSV warnings, since those rows silently do nothing.
  const overlayProblems = useMemo(() => recipeOverrideProblems(), [config])

  /** Swap in new text for one file. A broken CSV throws inside applyConfig and
   *  the running config is left exactly as it was. */
  function apply(key: ConfigFileKey, text: string, what: string): void {
    try {
      const next = applyConfig({ [key]: text })
      setConfig(next)
      setStatus({ tone: 'good', text: `${what} applied — world restarted` })
    } catch (err) {
      setStatus({ tone: 'warn', text: `${what} rejected: ${message(err)}` })
    }
  }

  function pickFile(key: ConfigFileKey): void {
    pendingKey.current = key
    fileInput.current?.click()
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    const key = pendingKey.current
    e.target.value = '' // let the same file be picked again after an edit
    if (!file || !key) return
    const label = CONFIG_FILES.find(f => f.key === key)?.label ?? key
    apply(key, await file.text(), `${label} (${file.name})`)
  }

  function revertAll(): void {
    setConfig(resetConfig())
    setStatus({ tone: 'good', text: 'back to the built-in config — world restarted' })
  }

  return (
    <div className="tech-overlay" onClick={onClose}>
      <div className="tech-modal bracketed config-modal" onClick={e => e.stopPropagation()}>
        <div className="tech-head">
          <span className="panel-label panel-label--amber">
            Config · Live Game Data {config.custom.length > 0 && <span className="orange">· uploaded</span>}
          </span>
          <button className="tutorial-skip" onClick={onClose} title="close (Esc)">close ✕</button>
        </div>

        <div className="config-summary tiny">
          <span><b>{summary.buildings}</b> buildings</span>
          <span><b>{summary.branches}</b> branches</span>
          <span><b>{summary.tiers}</b> tiers</span>
          <span><b>{summary.resources}</b> resources</span>
          <span><b>{summary.countries}</b> countries</span>
          <span><b>{summary.recipes}</b> recipe overrides</span>
        </div>

        {status && (
          <div className={`config-status tiny ${status.tone === 'good' ? 'green' : 'red'}`}>{status.text}</div>
        )}

        <div className="scroll-y config-body">
          <p className="tiny muted config-note">
            Edit a file in any spreadsheet, upload it here, and the game runs on it immediately —
            saved in this browser until you revert. Applying a file <b>restarts the world</b>: every
            city, your operator and the save are reseeded from the new data.
          </p>

          {CONFIG_FILES.map(file => {
            const text = config.source[file.key]
            const custom = config.custom.includes(file.key)
            return (
              <div key={file.key} className="config-file">
                <div className="row">
                  <span className="build-name">
                    {file.label} <span className={custom ? 'orange' : 'muted'}>· {custom ? 'uploaded' : 'built-in'}</span>
                  </span>
                  <span className="tiny muted">{lineCount(text)} rows</span>
                </div>
                <span className="build-recipe">{file.blurb}</span>
                <div className="config-actions">
                  <button className="mini-btn buy" onClick={() => pickFile(file.key)}>upload</button>
                  <button className="mini-btn" onClick={() => download(file.filename, text)}>download</button>
                  <button
                    className="mini-btn"
                    onClick={() => {
                      const opening = pasting !== file.key
                      setPasting(opening ? file.key : null)
                      if (opening) setDraft('')
                    }}
                  >
                    {pasting === file.key ? 'cancel' : 'paste'}
                  </button>
                  <button className="mini-btn" disabled={!custom} onClick={() => apply(file.key, BUILT_IN_SOURCE[file.key], file.label)}>
                    revert
                  </button>
                </div>
                {pasting === file.key && (
                  <div className="config-paste">
                    <textarea
                      className="field config-textarea"
                      autoFocus
                      spellCheck={false}
                      placeholder={`Paste ${file.filename} contents…`}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                    />
                    <button
                      className="mini-btn buy"
                      disabled={draft.trim() === ''}
                      onClick={() => { apply(file.key, draft, `${file.label} (pasted)`); setPasting(null); setDraft('') }}
                    >
                      apply pasted text
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {(config.warnings.length > 0 || overlayProblems.length > 0) && (
            <div className="config-warnings">
              <span className="panel-label">Warnings <span className="muted">· the game still runs</span></span>
              <ul className="tiny">
                {config.warnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}
                {overlayProblems.map((w, i) => <li key={`o${i}`}>recipe amounts: {w}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="config-footer">
          <button className="btn-ghost" disabled={config.custom.length === 0} onClick={revertAll}>
            Revert all to built-in
          </button>
          <button
            className="btn-ghost danger"
            onClick={() => { onResetGame(); setStatus({ tone: 'good', text: 'game data reset — world reseeded' }) }}
          >
            Reset game data
          </button>
        </div>

        <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFileChosen} />
      </div>
    </div>
  )
}
