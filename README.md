# branch-picker

Мод для Claude Code: выбор git-ветки прямо в интерфейсе, без включения worktree.

- Над полем ввода — полоса **Branch** со списком локальных веток; выбор ветки делает `git switch` в текущей папке сессии.
- Пока модель отвечает, вместо списка видна только текущая ветка.
- Команда `/branch` — список веток, `/branch <name>` — переключиться, `/branch -c <name>` — создать ветку и переключиться.

## Установка

В терминальной сессии `claude`:

```
/plugin install branch-picker --marketplace pro-verstka/claude-branch-picker
```

Или из shell:

```bash
claude plugin install branch-picker --marketplace pro-verstka/claude-branch-picker
```

На вопрос `Add marketplace?` ответьте `y`, затем выберите scope `user` (Enter). Мод заработает во всех новых сессиях, включая вкладку Code в Claude Desktop.

В Claude Desktop без терминала: **+** рядом с полем ввода → **Plugins** → **Add marketplace** → `pro-verstka/claude-branch-picker` → **Add plugin**.

## Учтите

`git switch` переносит незакоммиченные изменения в новую ветку или отказывается переключаться при конфликте — stash мод не делает. Модель не узнаёт о ручном переключении ветки, пока сама не выполнит git-команду.
