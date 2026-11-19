import { useEffect, useMemo, useState } from 'react'
import {
  Bell, ChevronDown, Clock3, Cloud, FileText, Folder, Grid2X2,
  HardDrive, Home, Image, List, LogOut, Menu, MoreHorizontal,
  Search, Settings, Share2, Star, Trash2, Upload, Users, X,
  FileArchive, Video, ShieldCheck, Activity, Download
} from 'lucide-react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from './services/firebase/firebase'
import { AuthProvider, useAuth } from './context/AuthContext'
import { downloadEncryptedFile, listOwnedFiles, listSharedFiles, moveToTrash, toggleStar, uploadEncryptedFile, type SecureFileRecord } from './services/file/fileService'
import { shareFile } from './services/sharing/sharingService'

type CloudFile = {
  id: number
  name: string
  type: 'PDF' | 'Image' | 'Document' | 'Video' | 'Archive'
  size: string
  modified: string
  starred?: boolean
  shared?: boolean
}

const seedFiles: CloudFile[] = [
  { id: 1, name: 'Q4 strategy.pdf', type: 'PDF', size: '8.4 MB', modified: 'Today, 10:42', starred: true, shared: true },
  { id: 2, name: 'Product mockups.fig', type: 'Image', size: '24.2 MB', modified: 'Yesterday', starred: true },
  { id: 3, name: 'Brand guidelines.docx', type: 'Document', size: '2.1 MB', modified: 'Nov 18', shared: true },
  { id: 4, name: 'Launch footage.mp4', type: 'Video', size: '184 MB', modified: 'Nov 17' },
  { id: 5, name: 'Research archive.zip', type: 'Archive', size: '64.7 MB', modified: 'Nov 14' },
  { id: 6, name: 'Team photo.jpg', type: 'Image', size: '6.8 MB', modified: 'Nov 12', shared: true },
]

const navItems = [
  { label: 'Overview', icon: Home, to: '/dashboard' },
  { label: 'My Files', icon: Folder, to: '/files' },
  { label: 'Shared With Me', icon: Users, to: '/shared' },
  { label: 'Recent Files', icon: Clock3, to: '/recent' },
  { label: 'Starred', icon: Star, to: '/starred' },
  { label: 'Trash', icon: Trash2, to: '/trash' },
]

function IconForFile({ type }: { type: CloudFile['type'] }) {
  const map = {
    PDF: { Icon: FileText, color: '#fb7185', bg: '#3b1d2a' },
    Image: { Icon: Image, color: '#60a5fa', bg: '#192944' },
    Document: { Icon: FileText, color: '#818cf8', bg: '#28284a' },
    Video: { Icon: Video, color: '#c084fc', bg: '#322344' },
    Archive: { Icon: FileArchive, color: '#fbbf24', bg: '#3a3421' },
  }
  const { Icon, color, bg } = map[type]
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: bg }}><Icon size={20} style={{ color }} /></span>
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#6c63ff] shadow-[0_8px_24px_rgba(108,99,255,.28)]">
        <Cloud size={20} fill="white" color="white" />
      </div>
      <span className="text-[17px] font-semibold tracking-tight text-white">SecureCloud</span>
    </div>
  )
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-white/[0.06] bg-[#0d111d] px-4 py-5 transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 px-2"><Logo /></div>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, to }) => (
            <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${isActive ? 'bg-[#1a2033] text-white' : 'text-[#8d96aa] hover:bg-white/[0.03] hover:text-[#dce2ef]'}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <NavLink to="/activity" className="mb-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-[#8d96aa] hover:bg-white/[0.03]"><Activity size={18} />Activity Logs</NavLink>
          <NavLink to="/settings" className="mb-5 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-[#8d96aa] hover:bg-white/[0.03]"><Settings size={18} />Settings</NavLink>
          <div className="rounded-2xl border border-white/[0.07] bg-[#111624] p-3.5">
            <div className="mb-2 flex items-center justify-between text-xs"><span className="text-[#b9c1d1]">Storage</span><span className="text-[#78839a]">42 GB / 100 GB</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#242b3b]"><div className="h-full w-[42%] rounded-full bg-[#6c63ff]" /></div>
          </div>
        </div>
      </aside>
    </>
  )
}

function Topbar({ onMenu, onUpload }: { onMenu: () => void; onUpload: () => void }) {
  const [profile, setProfile] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-white/[0.06] bg-[#090d18]/95 px-4 backdrop-blur-xl md:px-7">
      <button aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl text-[#9aa3b6] md:hidden" onClick={onMenu}><Menu size={20} /></button>
      <div className="relative max-w-[480px] flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#69748a]" size={17} />
        <input aria-label="Search files" className="h-10 w-full rounded-xl border border-white/[0.06] bg-[#111625] pl-10 pr-4 text-sm text-white outline-none placeholder:text-[#68738a] focus:border-[#6c63ff]/60" placeholder="Search files and folders..." />
      </div>
      <button aria-label="Upload" onClick={onUpload} className="ml-auto flex h-10 items-center gap-2 rounded-xl bg-[#6c63ff] px-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(108,99,255,.22)] hover:bg-[#7a72ff]">
        <Upload size={17} /><span className="hidden sm:inline">Upload</span>
      </button>
      <button aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.06] bg-[#111625] text-[#9aa3b6]"><Bell size={17} /></button>
      <div className="relative">
        <button onClick={() => setProfile(!profile)} className="flex items-center gap-2 rounded-xl p-1">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d9b7a3] text-xs font-bold text-[#3b251e]">AM</span>
          <ChevronDown size={14} className="hidden text-[#78839a] sm:block" />
        </button>
        {profile && (
          <div className="absolute right-0 top-12 w-48 rounded-xl border border-white/[0.08] bg-[#151a28] p-2 shadow-2xl">
            <button onClick={() => { setProfile(false); navigate('/settings') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#b4bccb] hover:bg-white/[0.04]"><Settings size={15} />Settings</button>
            <button onClick={async () => { await logout(); navigate('/login') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#fb7185] hover:bg-white/[0.04]"><LogOut size={15} />Sign out</button>
          </div>
        )}
      </div>
    </header>
  )
}

function StatCard({ icon: Icon, label, value, detail, color }: { icon: typeof HardDrive; label: string; value: string; detail: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111625] p-5">
      <div className="mb-5 flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${color}18`, color }}><Icon size={19} /></span>
        <MoreHorizontal size={18} className="text-[#59657a]" />
      </div>
      <p className="text-xs text-[#7f899d]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold text-white">{value}</span><span className="text-xs text-[#667188]">{detail}</span></div>
    </div>
  )
}

function FileRow({ file, onStar }: { file: CloudFile; onStar: (id: number) => void }) {
  return (
    <div className="group grid grid-cols-[minmax(180px,1fr)_100px_140px_32px] items-center gap-3 border-b border-white/[0.05] px-3 py-3 last:border-0 md:grid-cols-[minmax(220px,1fr)_100px_150px_32px]">
      <div className="flex min-w-0 items-center gap-3"><IconForFile type={file.type} /><span className="truncate text-sm text-[#dfe5f1]">{file.name}</span></div>
      <span className="text-xs text-[#7f899d]">{file.size}</span>
      <span className="text-xs text-[#7f899d]">{file.modified}</span>
      <button aria-label={file.starred ? 'Unstar file' : 'Star file'} onClick={() => onStar(file.id)} className={file.starred ? 'text-[#fbbf24]' : 'text-[#59657a] hover:text-[#fbbf24]'}><Star size={16} fill={file.starred ? 'currentColor' : 'none'} /></button>
    </div>
  )
}

function Dashboard({ files, setFiles }: { files: CloudFile[]; setFiles: (files: CloudFile[]) => void }) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const toggleStar = (id: number) => setFiles(files.map(file => file.id === id ? { ...file, starred: !file.starred } : file))
  const recent = files.slice(0, 4)
  return (
    <main className="mx-auto max-w-[1180px] p-4 md:p-7">
      <div className="mb-6 flex items-end justify-between">
        <div><p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-[#69748a]">Workspace</p><h1 className="text-2xl font-semibold text-white">Good morning, Alex</h1></div>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={HardDrive} label="Storage used" value="42.8 GB" detail="of 100 GB" color="#8b83ff" />
        <StatCard icon={Folder} label="Total files" value="1,284" detail="12 new" color="#60a5fa" />
        <StatCard icon={Share2} label="Shared files" value="38" detail="6 people" color="#c084fc" />
        <StatCard icon={ShieldCheck} label="Security" value="Encrypted" detail="All files" color="#34d399" />
      </section>
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#e9eef8]">Recent files</h2>
          <div className="flex rounded-lg border border-white/[0.06] bg-[#111625] p-1">
            <button aria-label="Grid view" onClick={() => setView('grid')} className={`grid h-7 w-7 place-items-center rounded-md ${view === 'grid' ? 'bg-[#252b3d] text-white' : 'text-[#77839a]'}`}><Grid2X2 size={14} /></button>
            <button aria-label="List view" onClick={() => setView('list')} className={`grid h-7 w-7 place-items-center rounded-md ${view === 'list' ? 'bg-[#252b3d] text-white' : 'text-[#77839a]'}`}><List size={15} /></button>
          </div>
        </div>
        {view === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recent.map(file => (
              <article key={file.id} className="rounded-2xl border border-white/[0.06] bg-[#111625] p-4 transition hover:border-white/[0.12]">
                <div className="mb-5 flex items-start justify-between"><IconForFile type={file.type} /><button onClick={() => toggleStar(file.id)} className={file.starred ? 'text-[#fbbf24]' : 'text-[#59657a]'}><Star size={16} fill={file.starred ? 'currentColor' : 'none'} /></button></div>
                <h3 className="truncate text-sm font-medium text-[#edf1f8]">{file.name}</h3>
                <p className="mt-1 text-xs text-[#737f95]">{file.size} · {file.modified}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111625]">
            {recent.map(file => <FileRow key={file.id} file={file} onStar={toggleStar} />)}
          </div>
        )}
      </section>
      <section className="mt-7 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-white/[0.06] bg-[#111625] p-5">
          <h2 className="mb-5 text-sm font-semibold">Storage overview</h2>
          <div className="flex h-28 items-end gap-2">{[35, 48, 42, 60, 53, 72, 68, 82, 76, 88, 92, 84].map((height, i) => <div key={i} className="flex-1 rounded-t-sm bg-[#625ce0]/70" style={{ height: `${height}%`, opacity: 0.35 + i * 0.05 }} />)}</div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#111625] p-5">
          <h2 className="mb-5 text-sm font-semibold">File categories</h2>
          {[['Documents', '38%', '#818cf8'], ['Images', '27%', '#60a5fa'], ['Videos', '21%', '#c084fc'], ['Other', '14%', '#94a3b8']].map(([label, value, color]) => (
            <div key={label} className="mb-4 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-[#9aa4b7]"><i className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span><span className="text-[#d7ddea]">{value}</span></div>
          ))}
        </div>
      </section>
    </main>
  )
}

function FilesPage({ files, setFiles, title = 'My Files' }: { files: CloudFile[]; setFiles: (files: CloudFile[]) => void; title?: string }) {
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => files.filter(file => file.name.toLowerCase().includes(query.toLowerCase())), [files, query])
  const toggleStar = (id: number) => setFiles(files.map(file => file.id === id ? { ...file, starred: !file.starred } : file))
  return (
    <main className="mx-auto max-w-[1180px] p-4 md:p-7">
      <div className="mb-5 flex items-center justify-between"><h1 className="text-2xl font-semibold">{title}</h1><div className="flex rounded-lg border border-white/[0.06] bg-[#111625] p-1"><button onClick={() => setView('grid')} className={`grid h-8 w-8 place-items-center rounded-md ${view === 'grid' ? 'bg-[#252b3d]' : 'text-[#77839a]'}`}><Grid2X2 size={15} /></button><button onClick={() => setView('list')} className={`grid h-8 w-8 place-items-center rounded-md ${view === 'list' ? 'bg-[#252b3d]' : 'text-[#77839a]'}`}><List size={16} /></button></div></div>
      <div className="relative mb-4 md:hidden"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#69748a]" size={16} /><input value={query} onChange={e => setQuery(e.target.value)} className="h-10 w-full rounded-xl border border-white/[0.06] bg-[#111625] pl-10 pr-3 text-sm outline-none" placeholder="Search" /></div>
      {view === 'grid' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(file => <article key={file.id} className="rounded-2xl border border-white/[0.06] bg-[#111625] p-4"><div className="mb-5 flex justify-between"><IconForFile type={file.type} /><button onClick={() => toggleStar(file.id)} className={file.starred ? 'text-[#fbbf24]' : 'text-[#59657a]'}><Star size={16} fill={file.starred ? 'currentColor' : 'none'} /></button></div><h3 className="truncate text-sm">{file.name}</h3><p className="mt-1 text-xs text-[#737f95]">{file.size}</p></article>)}</div> :
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111625]">{filtered.map(file => <FileRow key={file.id} file={file} onStar={toggleStar} />)}</div>}
    </main>
  )
}

function SimplePage({ title }: { title: string }) {
  return <main className="mx-auto max-w-[1180px] p-4 md:p-7"><h1 className="mb-5 text-2xl font-semibold">{title}</h1><div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/[0.10] bg-[#111625]/50"><div className="text-center"><ShieldCheck className="mx-auto mb-3 text-[#6c63ff]" size={32} /><p className="text-sm text-[#9aa4b7]">{title} will be connected to Firebase in the next phase.</p></div></div></main>
}

function UploadModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  if (!open) return null
  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return
    Array.from(fileList).forEach(file => onAdd(file))
    onClose()
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#050711]/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-2xl border border-white/[0.08] bg-[#151a28] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Upload files</h2><p className="mt-1 text-xs text-[#7f899d]">Files are encrypted before upload</p></div><button aria-label="Close upload dialog" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-[#8792a6] hover:bg-white/[0.05]"><X size={18} /></button></div>
        <label onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }} className={`grid min-h-[220px] cursor-pointer place-items-center rounded-2xl border border-dashed transition ${dragging ? 'border-[#8b83ff] bg-[#6c63ff]/10' : 'border-white/[0.12] bg-[#101521]'}`}>
          <input type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
          <div className="text-center"><span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#6c63ff]/15 text-[#8b83ff]"><Upload size={22} /></span><p className="text-sm text-[#dce3ef]">Drop files here or <span className="text-[#8b83ff]">browse</span></p><p className="mt-2 text-xs text-[#707b90]">Maximum file size 5 GB</p></div>
        </label>
      </div>
    </div>
  )
}

function SecureFilesPage({ shared = false, title = 'My Files' }: { shared?: boolean; title?: string }) {
  const { keyPair } = useAuth()
  const [files, setFiles] = useState<SecureFileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const reload = async () => {
    setError('')
    try {
      setFiles(shared ? await listSharedFiles() : await listOwnedFiles())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    const load = shared ? listSharedFiles() : listOwnedFiles()
    void load.then(records => { if (active) setFiles(records) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load files') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shared])

  const download = async (file: SecureFileRecord) => {
    if (!keyPair?.privateKey) { setError('Unlock your private key by signing in again'); return }
    try { await downloadEncryptedFile(file, keyPair.privateKey) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Download failed') }
  }

  const share = async (file: SecureFileRecord) => {
    if (!keyPair?.privateKey) { setError('Unlock your private key by signing in again'); return }
    const email = window.prompt('Recipient email address')
    if (!email) return
    try {
      await shareFile(file.fileId, keyPair.privateKey, email)
      setError('File shared successfully')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to share file')
    }
  }

  const trash = async (file: SecureFileRecord) => {
    try { await moveToTrash(file.fileId); await reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to move file to trash') }
  }

  const filtered = files.filter(file => file.encryptedFileName.toLowerCase().includes(query.toLowerCase()))
  return (
    <main className="mx-auto max-w-[1180px] p-4 md:p-7">
      <div className="mb-5 flex items-center justify-between"><h1 className="text-2xl font-semibold">{title}</h1><input value={query} onChange={event => setQuery(event.target.value)} className="h-10 w-[230px] rounded-xl border border-white/[0.06] bg-[#111625] px-3 text-sm outline-none" placeholder="Search encrypted files" /></div>
      {error && <p className="mb-3 rounded-xl border border-white/[0.07] bg-[#111625] px-4 py-3 text-sm text-[#b9c1d1]" role="alert">{error}</p>}
      {loading ? <div className="h-40 animate-pulse rounded-2xl border border-white/[0.06] bg-[#111625]" /> : filtered.length === 0 ? <div className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-white/[0.10] text-sm text-[#7f899d]">No encrypted files found</div> :
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111625]">
          {filtered.map(file => (
            <div key={file.fileId} className="grid grid-cols-[minmax(180px,1fr)_100px_180px] items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0">
              <div className="min-w-0"><p className="truncate text-sm text-[#dfe5f1]">{file.encryptedFileName}</p><p className="mt-1 text-xs text-[#737f95]">{(file.originalFileSize / 1024 / 1024).toFixed(2)} MB · {file.mimeType}</p></div>
              <button onClick={() => void toggleStar(file.fileId, !file.starred)} className="text-[#8b83ff]"><Star size={16} fill={file.starred ? 'currentColor' : 'none'} /></button>
              <div className="flex justify-end gap-2">
                <button aria-label={`Download ${file.encryptedFileName}`} onClick={() => void download(file)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.06] text-[#9aa4b7]"><Download size={16} /></button>
                {!shared && <button aria-label={`Share ${file.encryptedFileName}`} onClick={() => void share(file)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.06] text-[#9aa4b7]"><Share2 size={16} /></button>}
                {!shared && <button aria-label={`Trash ${file.encryptedFileName}`} onClick={() => void trash(file)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.06] text-[#fb7185]"><Trash2 size={16} /></button>}
              </div>
            </div>
          ))}
        </div>}
    </main>
  )
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const { createUserProfile, unlockKeys } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
        await createUserProfile(displayName.trim(), password)
        if (auth.currentUser) await sendEmailVerification(auth.currentUser)
      } else {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
        await unlockKeys(password)
      }
      navigate('/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }
  const forgotPassword = async () => {
    if (!email) {
      setError('Enter your email address first')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase())
      setError('Password reset email sent')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send reset email')
    }
  }
  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#090d18] lg:grid-cols-[1fr_480px]">
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(108,99,255,.14),transparent_35%),linear-gradient(145deg,#0b1020,#090d18)]" />
        <div className="relative flex h-full flex-col p-10"><Logo /><div className="my-auto max-w-[520px]"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#6c63ff]/20 bg-[#6c63ff]/10 px-3 py-1.5 text-xs text-[#aaa5ff]"><ShieldCheck size={14} />Zero-knowledge encryption</div><h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-white">Your files.<br />Only your eyes.</h1><p className="mt-5 max-w-[460px] text-base leading-7 text-[#8f99ac]">Securely store, share, and manage your files with private-by-design end-to-end encryption.</p></div></div>
      </div>
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-[360px]">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-2 text-sm text-[#818ca1]">{mode === 'login' ? 'Sign in to continue to your vault' : 'Start protecting your files today'}</p>
          {mode === 'register' && <label className="mt-7 block"><span className="mb-2 block text-xs text-[#adb6c7]">Full name</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} required className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#111625] px-3 text-sm outline-none focus:border-[#6c63ff]/70" placeholder="Alex Morgan" /></label>}
          <label className="mt-5 block"><span className="mb-2 block text-xs text-[#adb6c7]">Email address</span><input value={email} onChange={event => setEmail(event.target.value)} required type="email" className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#111625] px-3 text-sm outline-none focus:border-[#6c63ff]/70" placeholder="alex@example.com" /></label>
          <label className="mt-4 block"><span className="mb-2 block text-xs text-[#adb6c7]">Password</span><input value={password} onChange={event => setPassword(event.target.value)} required type="password" minLength={8} className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#111625] px-3 text-sm outline-none focus:border-[#6c63ff]/70" placeholder="••••••••" /></label>
          {mode === 'login' && <div className="mt-3 text-right"><button type="button" onClick={forgotPassword} className="text-xs text-[#8b83ff]">Forgot password?</button></div>}
          {error && <p className="mt-3 text-xs text-[#fb7185]" role="alert">{error}</p>}
          <button disabled={busy} className="mt-6 h-11 w-full rounded-xl bg-[#6c63ff] text-sm font-medium hover:bg-[#7a72ff] disabled:opacity-60">{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <p className="mt-5 text-center text-sm text-[#7f899d]">{mode === 'login' ? 'New to SecureCloud?' : 'Already have an account?'} <button type="button" onClick={() => navigate(mode === 'login' ? '/register' : '/login')} className="text-[#9a95ff]">{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>
        </form>
      </main>
    </div>
  )
}

function AppShell() {
  const { keyPair, user, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [files, setFiles] = useState(seedFiles)
  const [uploadError, setUploadError] = useState('')
  const addFile = async (file: File) => {
    if (!keyPair?.publicKey) {
      setUploadError('Private-key profile is locked. Sign out and sign in again.')
      return
    }
    try {
      await uploadEncryptedFile(file, keyPair.publicKey)
      setUploadError('')
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'Encrypted upload failed')
    }
  }
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#090d18] text-sm text-[#8d96aa]">Loading SecureCloud...</div>
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="min-h-screen bg-[#090d18] text-[#e9eef8]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:pl-[248px]"><Topbar onMenu={() => setSidebarOpen(true)} onUpload={() => setUploadOpen(true)} />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard files={files} setFiles={setFiles} />} />
          <Route path="/files" element={<SecureFilesPage />} />
          <Route path="/shared" element={<SecureFilesPage shared title="Shared With Me" />} />
          <Route path="/recent" element={<FilesPage files={files.slice(0, 4)} setFiles={setFiles} title="Recent Files" />} />
          <Route path="/starred" element={<FilesPage files={files.filter(file => file.starred)} setFiles={setFiles} title="Starred" />} />
          <Route path="/trash" element={<SimplePage title="Trash" />} />
          <Route path="/activity" element={<SimplePage title="Activity Logs" />} />
          <Route path="/settings" element={<SimplePage title="Settings" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      {uploadError && <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-xl border border-[#fb7185]/20 bg-[#251822] px-4 py-3 text-sm text-[#fecdd3]" role="alert">{uploadError}</div>}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onAdd={addFile} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
