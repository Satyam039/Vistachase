import re

with open('package.json', 'r') as f:
    content = f.read()

content = content.replace('"build": "next build",', '"build": "next build",\n    "postbuild": "next-sitemap",')

with open('package.json', 'w') as f:
    f.write(content)
