import type { EngineInterface as $, Register } from 'claude-code'

import type { Repo } from '../types'

const REPO = { plugin: 'branch-picker', key: 'repo' } as const

function git($: $, args: string[]) {
  return $.process
    .run(['git', ...args])
    .catch(err => ({ exitCode: 1, stdout: '', stderr: String(err) }))
}

async function refresh($: $): Promise<Repo | null> {
  const head = await git($, ['branch', '--show-current'])
  if (head.exitCode !== 0) {
    await $.state.set(REPO, null)
    return null
  }
  const refs = await git($, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  const next: Repo = {
    current: head.stdout.trim(),
    branches: refs.stdout.split('\n').filter(Boolean),
  }
  await $.state.set(REPO, next)
  return next
}

async function gitSwitch($: $, args: string[]) {
  const ran = await git($, ['switch', ...args])
  const now = await refresh($)
  return ran.exitCode === 0 ? `Switched to ${now?.current || 'detached HEAD'}` : `git switch failed: ${(ran.stderr || ran.stdout).trim()}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await refresh($)
    await $.command.register({
      name: 'git-branch',
      description: 'Switch git branch without a worktree: /git-branch <name>, /git-branch -c <new>',
    })
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refresh($)
    return done
  })

  on('command.run', { command: 'git-branch' }, async ($, e) => {
    const args = e.args.trim().split(/\s+/).filter(Boolean)
    if (args.length === 0) {
      const now = await refresh($)
      if (!now) return { text: 'Not a git repository.' }
      return { text: now.branches.map(b => (b === now.current ? `* ${b}` : `  ${b}`)).join('\n') }
    }
    return { text: await gitSwitch($, args) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { value: now } = await $.state.get(REPO)
    if (e.props.hasSurvey || !now) return next(e)

    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const label = now.current || 'detached HEAD'

    // Switching mid-turn would change files under the model's feet.
    if (e.props.isWorking || !('Select' in elements)) {
      return (
        <Box>
          <Text dimColor>Branch: {label}</Text>
        </Box>
      )
    }

    const { Select } = elements
    // Detached HEAD and a repo without commits have no ref for the current branch.
    const options = [
      ...(now.branches.includes(now.current) ? [] : [{ value: now.current, label }]),
      ...now.branches.map(b => ({ value: b })),
    ]

    return (
      <Box>
        <Select
          key="branch"
          label="Branch"
          options={options}
          value={now.current}
          onSelect={async value => {
            if (!value || value === now.current) return
            $.ui.toast(await gitSwitch($, [value]))
          }}
        />
      </Box>
    )
  })
}
