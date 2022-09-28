const path = require('path')
const {get} = require('lodash')
const posthtml = require('posthtml')
const {stripHtml} = require('string-strip-html')

const self = {
  handleCustomTags: (html, config = {}) => {
    const posthtmlOptions = get(config, 'build.posthtml.options', {})

    const posthtmlPlugin = () => tree => {
      const process = node => {
        if (node.tag === 'plaintext') {
          return {
            tag: false,
            content: ['']
          }
        }

        if (node.tag === 'not-plaintext') {
          return {
            tag: false,
            content: tree.render(node.content)
          }
        }

        return node
      }

      return tree.walk(process)
    }

    return posthtml([posthtmlPlugin()]).process(html, {...posthtmlOptions, sync: true}).html
  },
  generate: async (html, destination, config) => {
    const configDestinationPath = get(config, 'destination.path')
    const extension = get(config, 'destination.extension', 'txt')

    const plaintext = stripHtml(html, {
      dumpLinkHrefsNearby: {
        enabled: true
      },
      stripTogetherWithTheirContents: ['script', 'style', 'xml', 'not-plaintext'],
      ...get(config, 'options', {})
    }).result

    html = self.handleCustomTags(html, config)

    // If we set plaintext.destination.path in config/fm
    if (configDestinationPath) {
      /**
       * Using a file path will generate a single plaintext file,
       * no matter how many templates there are.
       *
       * It will be based on the last-processed template.
       */
      if (path.extname(configDestinationPath)) {
        destination = configDestinationPath

        return {html, plaintext, destination}
      }

      /**
       * Using a directory-like path for plaintext.destination.path
       */
      destination = path.join(configDestinationPath, path.basename(config.filepath, path.extname(config.filepath)) + '.' + extension)

      return {html, plaintext, destination}
    }

    /**
     * Use template's `permalink` Front Matter key,
     * fall back to the original `destination`.
     */
    destination = get(config, 'permalink', destination)

    if (typeof destination === 'string') {
      destination = path.join(path.dirname(destination), path.basename(destination, path.extname(destination)) + '.' + extension)
    }

    return {html, plaintext, destination}
  }
}

module.exports = self
