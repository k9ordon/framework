const marked = require('marked')
const fm = require('front-matter')
const deepmerge = require('deepmerge')
const NunjucksEnvironment = require('../../nunjucks')

const Tailwind = require('../tailwind')
const Transformers = require('../../transformers')

module.exports = async (str, options) => {
  try {
    if (str && str.length < 1) {
      throw RangeError('received empty string')
    }

    if (typeof str !== 'string') {
      throw TypeError(`first argument must be a string, received ${str}`)
    }

    const css = options && options.tailwind && typeof options.tailwind.css === 'string' ? options.tailwind.css : '@tailwind components; @tailwind utilities;'
    const tailwindConfig = options && options.tailwind && typeof options.tailwind.config === 'object' ? options.tailwind.config : null
    const maizzleConfig = options && options.maizzle && typeof options.maizzle.config === 'object' ? options.maizzle.config : null

    if (!maizzleConfig) {
      throw TypeError(`received invalid Maizzle config: ${maizzleConfig}`)
    }

    const frontMatter = fm(str)
    let html = frontMatter.body

    const config = maizzleConfig.isMerged ? maizzleConfig : deepmerge(maizzleConfig, frontMatter.attributes)
    const layout = config.layout || config.build.layout

    if (typeof options.afterConfig === 'function') {
      await options.afterConfig(config)
    }

    let compiledCSS = options.tailwind.compiled || null

    if (!compiledCSS) {
      if (!tailwindConfig) {
        throw TypeError(`received invalid Tailwind CSS config: ${tailwindConfig}`)
      }

      compiledCSS = await Tailwind.fromString(css, html, tailwindConfig, maizzleConfig).catch(err => { console.log(err); process.exit() })
    }

    marked.setOptions({
      renderer: new marked.Renderer(),
      ...config.markdown
    })

    const nunjucks = await NunjucksEnvironment.init(config.build.nunjucks)

    if (typeof options.beforeRender === 'function') {
      await options.beforeRender(nunjucks, config)
    }

    const blockStart = config.build.nunjucks && config.build.nunjucks.tags ? config.build.nunjucks.tags.blockStart : '{%'
    const blockEnd = config.build.nunjucks && config.build.nunjucks.tags ? config.build.nunjucks.tags.blockEnd : '%}'

    html = layout ? `${blockStart} extends "${layout}" ${blockEnd}\n${html}` : html
    html = nunjucks.renderString(html, { page: config, env: options.env, css: compiledCSS })

    while (fm(html).attributes.layout) {
      const front = fm(html)
      html = `${blockStart} extends "${front.attributes.layout}" ${blockEnd}\n${blockStart} block template ${blockEnd}${front.body}${blockStart} endblock ${blockEnd}`
      html = nunjucks.renderString(html, { page: config, env: options.env, css: compiledCSS })
    }

    html = html
      // Rewrite class names in `<head>` CSS
      .replace(/(\..+)(\\:|\\\/|\\%)/g, group => {
        return group
          .replace(/\\:|\\\//g, '-') // replace `\/` and `\:` with `-`
          .replace(/\\%/g, 'pc') // replace `%` with `pc`
      })
      // Rewrite class names in `<body>` HTML
      .replace(/class\s*=\s*["'][^"']*[/:][^"']*["']/g, group => {
        return group
          .replace(/\/|:/g, '-') // replace `\/` and `\:` with `-`
          .replace(/%/g, 'pc') // replace `%` with `pc`
      })

    if (typeof options.afterRender === 'function') {
      html = await options.afterRender(html, config)
    }

    html = await Transformers.process(html, config)

    if (typeof options.afterTransformers === 'function') {
      html = await options.afterTransformers(html, config)
    }

    return html
  } catch (error) {
    throw error
  }
}
