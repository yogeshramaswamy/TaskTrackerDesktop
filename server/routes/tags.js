const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');

// Tag library: user-defined tags with an optional description/color. These power
// the autocomplete in the tag input and give tags a shared meaning across tasks.

router.get('/', (req, res) => {
  const tags = all('SELECT * FROM tag_library ORDER BY name COLLATE NOCASE ASC');
  res.json(tags);
});

router.post('/', (req, res) => {
  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim() || null;
  const color = (req.body.color || '').trim() || null;
  if (!name) return res.status(400).json({ error: 'Tag name is required' });

  const existing = get('SELECT * FROM tag_library WHERE name = ? COLLATE NOCASE', [name]);
  if (existing) return res.status(409).json({ error: 'A tag with that name already exists' });

  const result = run('INSERT INTO tag_library (name, description, color) VALUES (?, ?, ?)', [name, description, color]);
  res.status(201).json(get('SELECT * FROM tag_library WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM tag_library WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Tag not found' });

  const name = req.body.name !== undefined ? (req.body.name || '').trim() : existing.name;
  if (!name) return res.status(400).json({ error: 'Tag name is required' });

  // Guard against renaming onto another tag's name.
  const clash = get('SELECT id FROM tag_library WHERE name = ? COLLATE NOCASE AND id != ?', [name, id]);
  if (clash) return res.status(409).json({ error: 'A tag with that name already exists' });

  const description = req.body.description !== undefined ? ((req.body.description || '').trim() || null) : existing.description;
  const color = req.body.color !== undefined ? ((req.body.color || '').trim() || null) : existing.color;

  run('UPDATE tag_library SET name = ?, description = ?, color = ? WHERE id = ?', [name, description, color, id]);
  res.json(get('SELECT * FROM tag_library WHERE id = ?', [id]));
});

router.delete('/:id', (req, res) => {
  const result = run('DELETE FROM tag_library WHERE id = ?', [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Tag not found' });
  res.json({ success: true });
});

module.exports = router;
