const test = require('ava')
const Maizzle = require('../src')

const {join} = require('path')
const {readFileSync} = require('fs')

const fixture = file => readFileSync(join(__dirname, 'fixtures', `${file}.html`), 'utf8')
const expected = file => readFileSync(join(__dirname, 'expected', `${file}.html`), 'utf8')

const renderString = (string, options = {}) => Maizzle.render(string, options).then(html => html)

test('It compiles HTML string if no options are passed', async t => {
  const html = await renderString(fixture('basic'))

  t.is(html, expected('basic'))
})

test('It throws if first argument is not an HTML string', async t => {
  await t.throwsAsync(async () => {
    await renderString(false)
  }, {instanceOf: TypeError, message: 'first argument must be an HTML string, received false'})
})

test('It throws if first argument is an empty string', async t => {
  await t.throwsAsync(async () => {
    await renderString('')
  }, {instanceOf: RangeError, message: 'received empty string'})
})
