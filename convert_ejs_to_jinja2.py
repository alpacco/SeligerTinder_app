#!/usr/bin/env python3
"""Конвертация EJS шаблона в Jinja2"""
import re

# Читаем файл
with open('views/index.ejs', 'r', encoding='utf-8') as f:
    content = f.read()

# Конвертируем EJS в Jinja2
# <%= variable %> -> {{ variable }}
content = re.sub(r'<%=\s*([^%]+?)\s*%>', r'{{\1}}', content)

# <% if (condition) { %> -> {% if condition %}
content = re.sub(r'<% if \(([^)]+)\) { %>', r'{% if \1 %}', content)

# <% } else { %> -> {% else %}
content = re.sub(r'<% } else { %>', r'{% else %}', content)

# <% } %> -> {% endif %}
content = re.sub(r'<% } %>', r'{% endif %}', content)

# <% gifts.forEach(function(gift) { %> -> {% for gift in gifts %}
content = re.sub(r'<% gifts\.forEach\(function\((\w+)\) { %>', r'{% for \1 in gifts %}', content)

# <% }); %> -> {% endfor %}
content = re.sub(r'<% }\); %>', r'{% endfor %}', content)

# Исправляем специфичные случаи для Jinja2
# hashMap['main-css'] -> hashMap.get('main-css', '')
content = re.sub(r"hashMap\['([^']+)'\]", r"hashMap.get('\1', '')", content)
content = re.sub(r'hashMap\["([^"]+)"\]', r"hashMap.get('\1', '')", content)

# user.photoUrl || "/img/logo.svg" -> (user.get('photoUrl') or "/img/logo.svg")
content = re.sub(r"user\.(\w+)\s*\|\|\s*\"([^\"]+)\"", r"(user.get('\1') or '\2')", content)
content = re.sub(r"user\.(\w+)\s*\|\|\s*'([^']+)'", r"(user.get('\1') or '\2')", content)

# user.photos && user.photos.length -> (user.get('photos') and user.get('photos')|length)
content = re.sub(r"user\.photos\s*&&\s*user\.photos\.length", r"(user.get('photos') and user.get('photos')|length)", content)

# user.age ? user.age + ' лет' : '' -> (user.get('age') + ' лет' if user.get('age') else '')
content = re.sub(r"user\.age\s*\?\s*user\.age\s*\+\s*' лет'\s*:\s*''", r"(user.get('age') + ' лет' if user.get('age') else '')", content)

# Array.isArray(gifts) && gifts.length -> (gifts and gifts|length > 0)
content = re.sub(r"Array\.isArray\(gifts\)\s*&&\s*gifts\.length", r"(gifts and gifts|length > 0)", content)

# Сохраняем
with open('views/index.j2', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Конвертирован index.ejs -> index.j2')

