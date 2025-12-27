# Настройка GitHub для проекта

## Шаг 1: Проверка SSH ключа

### Если SSH ключа нет:

1. Создайте новый SSH ключ:
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

2. Нажмите Enter для сохранения в стандартное место (`~/.ssh/id_ed25519`)

3. Добавьте ключ в ssh-agent:
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

4. Скопируйте публичный ключ:
```bash
cat ~/.ssh/id_ed25519.pub
```

### Если SSH ключ уже есть:

Скопируйте публичный ключ:
```bash
cat ~/.ssh/id_ed25519.pub
# или
cat ~/.ssh/id_rsa.pub
```

## Шаг 2: Добавление SSH ключа в GitHub

1. Перейдите на GitHub.com
2. Нажмите на ваш аватар (правый верхний угол)
3. Выберите **Settings**
4. В левом меню выберите **SSH and GPG keys**
5. Нажмите **New SSH key**
6. Вставьте скопированный публичный ключ
7. Нажмите **Add SSH key**

## Шаг 3: Создание репозитория на GitHub

1. Перейдите на GitHub.com
2. Нажмите **New repository** (зеленая кнопка или + в правом верхнем углу)
3. Название: `SeligerTinder_app` (или любое другое)
4. Выберите **Private** или **Public**
5. **НЕ** добавляйте README, .gitignore или лицензию (у нас уже есть)
6. Нажмите **Create repository**

## Шаг 4: Добавление GitHub remote

После создания репозитория GitHub покажет инструкции. Выполните:

```bash
# Добавить GitHub remote (замените YOUR_USERNAME на ваш GitHub username)
git remote add github git@github.com:YOUR_USERNAME/SeligerTinder_app.git

# Или если хотите использовать HTTPS (проще, но требует токен):
git remote add github https://github.com/YOUR_USERNAME/SeligerTinder_app.git
```

## Шаг 5: Закоммитить и отправить изменения

```bash
# Добавить все изменения
git add .

# Создать коммит
git commit -m "Добавлена поддержка PostgreSQL и улучшения backend"

# Отправить в GitHub
git push github master

# Или если ветка называется main:
git push github master:main
```

## Проверка подключения

Проверьте, что SSH ключ работает:

```bash
ssh -T git@github.com
```

Должно появиться сообщение:
```
Hi YOUR_USERNAME! You've successfully authenticated...
```

## Deploy Keys (для Railway)

**Deploy Keys** нужны для серверов (например Railway), а не для локальной разработки.

Для локальной разработки используйте ваш личный SSH ключ (шаги выше).

Для Railway:
1. Railway может использовать GitHub App (рекомендуется)
2. Или можно добавить Deploy Key в настройках репозитория GitHub
3. Railway автоматически настроит доступ при подключении через GitHub

## Полезные команды

```bash
# Посмотреть все remotes
git remote -v

# Изменить URL remote
git remote set-url github git@github.com:USERNAME/REPO.git

# Удалить remote
git remote remove github

# Отправить в несколько remotes
git push github main  # в GitHub (Railway автоматически деплоит из GitHub)
git push github master   # в GitHub
```

