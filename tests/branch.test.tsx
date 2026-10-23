import { expect, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'

const BAND = {
  plugin: 'branch-picker',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

function branch($: Engine, args: string) {
  return $.command.run({
    command: 'branch',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
}

function fakeGit(on: Parameters<TestBody>[1], start = 'main', refs = 'main\nfeature\n') {
  let current = start
  const switched: string[][] = []
  const toasts: string[] = []
  on('process.run', (_, e) => {
    const [, cmd, ...rest] = e.argv
    if (cmd === 'branch') return { value: ok(`${current}\n`) }
    if (cmd === 'for-each-ref') return { value: ok(refs) }
    switched.push(rest)
    if (rest[0] === 'missing') return { value: { ...ok(''), exitCode: 128, stderr: "fatal: invalid reference: missing\n" } }
    current = rest[rest.length - 1] ?? current
    return { value: ok('') }
  })
  on('command.register', () => ({ value: { command: 'branch' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', (_, e) => (toasts.push(e.text), { value: undefined }))
  return { switched, toasts }
}

function ok(stdout: string) {
  return { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
}

test('the band switches branch through git switch', async ($, on) => {
  const git = fakeGit(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ key: 'branch' }))?.props.value).toBe('main')

  await ui.select({ key: 'branch', value: 'feature' })
  expect(git.switched).toEqual([['feature']])
  expect(git.toasts).toEqual(['Switched to feature'])
  expect((await ui.find({ key: 'branch' }))?.props.value).toBe('feature')
  await ui.unmount()
})

test('the band draws in a repo without commits', async ($, on) => {
  fakeGit(on, 'main', '')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const fresh = await $.ui.mount(BAND)
  expect((await fresh.find({ key: 'branch' }))?.props.options).toEqual([{ value: 'main', label: 'main' }])
  await fresh.unmount()
})

test('the band offers detached HEAD as the current pick', async ($, on) => {
  fakeGit(on, '')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(BAND)
  const select = await ui.find({ key: 'branch' })
  expect(select?.props.value).toBe('')
  expect(select?.props.options).toEqual([
    { value: '', label: 'detached HEAD' },
    { value: 'main' },
    { value: 'feature' },
  ])
  await ui.unmount()
})

test('the band only shows the branch while a turn runs', async ($, on) => {
  fakeGit(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, isWorking: true } })
  expect(await ui.find({ key: 'branch' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /Branch: main/ }))?.text).toBe('Branch: main')
  await ui.unmount()
})

test('/branch lists, switches and reports git errors', async ($, on) => {
  const git = fakeGit(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect((await branch($, '')).text).toBe('* main\n  feature')
  expect((await branch($, '-c new')).text).toBe('Switched to new')
  expect(git.switched).toEqual([['-c', 'new']])
  expect((await branch($, 'missing')).text).toBe(
    'git switch failed: fatal: invalid reference: missing',
  )
})
