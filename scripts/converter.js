#! /usr/bin/node

//import mdProcessor from '../htmlToMDX.js'
import fs from 'fs'
import path from 'path'
import remarkMdx from 'remark-mdx'
import mdxMetadata from 'remark-mdx-metadata'
import rehypeAttributes from 'rehype-attributes'
import { selectAll } from 'unist-util-select'
import { toString } from 'hast-util-to-string'
//export const converter = (dir) =>

import { all } from 'hast-util-to-mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGFM from 'remark-gfm'
import { reporter } from 'vfile-reporter'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'
import { visit } from 'unist-util-visit'

//import { similarity } from './findSimilarity.js'
import { link } from 'fs/promises'
import { findAndReplace } from 'mdast-util-find-and-replace'
import replaceHeadings from './replaceHeadings.js'
import badConverter from './badconverter.js'

const homedir = '../raw_manuals/'

const dir = fs.readdirSync(homedir)

const license =
  'This is the GNU Emacs Lisp Reference Manual\ncorresponding to Emacs version 27.2.\n\nCopyright (C) 1990-1996, 1998-2021 Free Software Foundation,\nInc.\n\nPermission is granted to copy, distribute and/or modify this document\nunder the terms of the GNU Free Documentation License, Version 1.3 or\nany later version published by the Free Software Foundation; with the\nInvariant Sections being "GNU General Public License," with the\nFront-Cover Texts being "A GNU Manual," and with the Back-Cover\nTexts as in (a) below.  A copy of the license is included in the\nsection entitled "GNU Free Documentation License."\n\n(a) The FSF\'s Back-Cover Text is: "You have the freedom to copy and\nmodify this GNU manual.  Buying copies from the FSF supports it in\ndeveloping GNU and promoting software freedom." '

const rehypeProcessor = unified()
  // .use(remarkGFM)
  .use(remarkMdx)
  .use(remarkGFM)
  .use(rehypeRemark, {
    handlers: {
      // comment: (h, node) => h(node, 'text', ''),
      footnoteReference(h, node) {
        return h(node, 'footnoteReference', {
          label: node.label,
          identifier: node.identifier,
        })
      },
      footnoteDefinition(h, node) {
        const wrapped = h.wrapText
        h.wrapText = false
        const result = h(
          node,
          'footnoteDefinition',
          { label: node.label, identifier: node.identifier },
          all(h, node)
        )
        h.wrapText = wrapped
        return result
      },
    },
  })

  .use(() => (node) => {
    visit(node, 'code', (element) => {
      if (!element.value) {
        element.type = 'text'
        element.value = ''
        return
      }
      element.lang = 'lisp'
    })
  })

  // get rid of those dang tables in auctex, like whyyyyyy the tables,
  // this isn't gosh darn 2003
  .use(() => (node) => {
    visit(node, 'table', (table) => {
      fs.writeFileSync('./table', JSON.stringify(table, null, 2))
      let codeBlocksTrappedInTables = []
      visit(table, 'code', (code) => {
        codeBlocksTrappedInTables.push(code)
      })
      if (codeBlocksTrappedInTables.length !== 1) return

      const trappedCode = codeBlocksTrappedInTables[0]
      Object.assign(table, trappedCode)
    })
  })
  // .use(() => (node) => {
  //   visit(node, 'text', (text) => {
  //     if (text.value.includes('<') || text.value.includes('>')) {
  //       text.value = text.value.replaceAll(/</g, '\\<')
  //       text.value = text.value.replaceAll(/(?<!\\)>/g, '\\>')
  //     }
  //   })
  // })
  .use(() => (node) => {
    visit(node, 'heading', (heading) => {
      // Auctex hides the keyword in an emphasis tag , sneakyy
      const keywordIsTextNode = heading?.children?.[0].type === 'text'

      const headingWord = keywordIsTextNode
        ? heading?.children?.[0]?.value
        : heading?.children?.[0]?.children?.[0]?.value

      if (!headingWord?.includes(':')) return

      const [keyword, word] = headingWord
        .replaceAll(/(\w+):(.*?)/g, '$1@$2')
        .split('@')

      if (keywordIsTextNode) {
        heading.children[0].value = word
      } else {
        heading.children = heading.children.slice(1)
      }

      const mdxEl = {
        type: 'mdxJsxTextElement',
        name: 'span',
        attributes: [
          {
            type: 'mdxJsXAttribute',
            name: 'className',
            value: `tag ${keyword.toLowerCase().replaceAll(/ /g, '')}`,
          },
        ],
        children: [{ type: 'inlineCode', value: keyword.toLowerCase() }],
      }

      const kids = [mdxEl, ...heading.children]

      heading.children = kids
    })
    // visit from unist-util-visit
    // visit(node, 'root', (root) => {
    //   const childs = root.children

    //   const newChilds = childs.flatMap((child) => {
    //     if (child.type !== 'list') return child

    //     if (child.ordered) return child
    //     const items = child.children

    //     const reworkedList = items.flatMap((listItem) => {
    //       const listItemContents = listItem?.children

    //       const heading = listItemContents?.[0]

    //       const kids = [mdxEl, ...heading.children]
    //       // if (heading?.type !== 'paragraph') return listItemContents

    //       const newHeading = Object.fromEntries([
    //         ['type', 'heading'],
    //         ['depth', 3],
    //         ['children', kids || []],
    //       ])

    //       return [newHeading, ...listItemContents.slice(1)]
    //     })

    //     return reworkedList
    //   })
    //   root.children = newChilds
    // })
    // fix the last fucking mistakes
    findAndReplace(node, '”', '"')
    findAndReplace(node, '>', '﹥')
    findAndReplace(node, '<', '﹤')
  })
  .use(remarkStringify)

const singleFileProcessor = unified()
  .use(rehypeParse, {
    emitParseErrors: true,
    duplicateAttribute: false,
  })
  .use(() => (node) => {
    visit(node, 'element', (element) => {
      if (
        element.tagName === 'div' &&
        element.properties?.className?.includes('header')
      ) {
        element.children = []
      }
      //  element.properties.lang = 'lisp'
    })
  })

const dirs = ['org', 'elisp', 'emacs', 'auctex', 'magit']

const bigFileProcessor = (f, dir) => {
  // Build anchor-to-section map for v7 format link resolution
  const anchorToSection = {}
  if (f) {
    // Deep sections (subsubsection, appendixsubsec) get appended to their parent
    // file rather than written standalone, so links to them should resolve to the parent
    const deepExtentClasses = ['subsubsection-level-extent', 'appendixsubsec-level-extent']

    const walkForAnchors = (el, parentSectionId) => {
      const cls = el.properties?.className || []
      const isSection = cls.some((c) => c.includes('level-extent'))
      const isDeepSection = cls.some((c) => deepExtentClasses.includes(c))
      const sectionId = isSection ? el.properties?.id : parentSectionId

      // Map deep section IDs to their parent (they get appended, not standalone)
      if (isDeepSection && el.properties?.id) {
        anchorToSection[el.properties.id] = parentSectionId
      }

      if (el.properties?.id && el.properties.id !== sectionId) {
        anchorToSection[el.properties.id] = sectionId
      }
      if (el.properties?.name) {
        anchorToSection[el.properties.name] = sectionId
      }

      for (const child of el.children || []) {
        if (child.type === 'element') walkForAnchors(child, isDeepSection ? parentSectionId : sectionId)
      }
    }
    visit(f, 'element', (el) => {
      if (el.properties?.className?.includes('top-level-extent')) {
        walkForAnchors(el, 'Top')
      }
    })
  }

  return unified()
    .use(rehypeParse, {
      emitParseErrors: true,
      duplicateAttribute: false,
    })
    .use(() => (node) => {
      dir === 'auctex' &&
        fs.writeFileSync('./auctextree', JSON.stringify(node, null, 2))
      visit(node, 'element', (link) => {
        if (link.tagName !== 'a') return
        if (!link?.properties?.href) {
          link.tagName = 'span'
          link.properties.id = link.properties.name
          return
        }

        const href = link.properties.href
        if (href.includes('FOOT')) return
        // Skip external links (http, https, mailto, ftp, etc.)
        if (/^(https?:|mailto:|ftp:)/i.test(href)) return
        if (href.startsWith('#') === false && /^[a-z]+:/i.test(href)) return

        const cleanerLink = href.replaceAll(/.*?#/g, '')

        // Resolve anchor IDs to their parent section slug (v7 format)
        const resolvedLink = anchorToSection[cleanerLink] || cleanerLink
        link.properties.href = `/docs/${dir}/${resolvedLink}`
      })
    })
    .use(() => (node) =>
      // Make all the h4s into h3s so the heading structure is better
      // and the headers show up on the side

      //also make tags for kbds
      visit(node, 'element', (heading) => {
        if (heading?.tagName !== 'h4') return
        heading.tagName = 'h3'
        if (dir === 'org') heading.tagName = 'h2'
      })
    )
    .use(() => (node) =>
      // Turn all lines which start with an inline code into a header, as these are usually
      // meant as headings
      // only really relevant for org files though, so we hard filter it
      {
        // if (dir !== 'org') return
        visit(node, 'element', (heading) => {
          if (heading?.tagName === 'dl') {
            heading.tagName = 'div'
            return
          }
          if (heading?.tagName === 'dd') {
            heading.tagName = 'div'
          }

          if (heading?.tagName === 'dt') {
            heading.tagName = 'h3'
            return
          }
        })
      }
    )
    // hmm yes very elegant solution
    // basically: loop through all the subnodes of the hast tree
    // chop up the tree in sections between "header" divs
    // parse, stringify and write those divs

    // i thought this would be easier than having to download all the individual files
    // from gnu, but it turns out this has more problems, such as needing to redo the links and footnotes
    // i 'solved" those but it's not ideal, for a second iteration i should just download all the files,
    // who cares if i ddos them a little
    .use(() => (node) => {
      // Detect format: Texinfo 7.2 uses *-level-extent classes
      let isV7 = false
      visit(node, 'element', (el) => {
        if (el.properties?.className?.some((c) => c.includes('level-extent'))) isV7 = true
      })

      // Extract footnotes — supports both old (div.footnote) and new (div.footnotes-segment) formats
      let footNotes = {}
      visit(node, 'element', (heading) => {
        if (heading?.tagName !== 'div') return
        const cls = heading?.properties?.className || []
        if (!cls.includes('footnote') && !cls.includes('footnotes-segment')) return

        const footNoteList = heading.children.reduce((acc, curr, index) => {
          if (curr.tagName !== 'h5') return acc

          const a = curr.children[0]
          const thangy = heading.children[index + 2]
          acc[a.properties.id] = thangy
          return acc
        }, {})

        footNotes = footNoteList
      })

      const headingObject = JSON.parse(
        fs.readFileSync('./headingsToReplace.json', { encoding: 'utf8' })
      )

      // Shared: process a section's content nodes into a markdown file
      const writeSection = ({ contentNodes, slug, title, alreadyDone }) => {
        if (!title || title === 'empty') return
        if (alreadyDone.includes(title)) return
        alreadyDone.push(title)

        const newTreeBeforeFootNotes = {
          type: 'root',
          children: [
            {
              type: 'element',
              tagName: 'body',
              children: contentNodes,
            },
          ],
        }

        let footNoteCounter = 0
        let footNoteLinks = []

        visit(newTreeBeforeFootNotes, 'element', (footnote) => {
          const href = footnote?.properties?.href
          if (!href) return
          if (!href.includes('#FOOT')) return

          footNoteLinks.push(href.replaceAll(/#/g, ''))
          footNoteCounter++

          footnote.label = footNoteCounter
          footnote.identifier = footNoteCounter
          footnote.tagName = 'footnoteReference'
          footnote.children = []
          footnote.properties = {}
        })

        const feet = {
          type: 'element',
          tagName: 'div',
          className: 'footnotediv',
          children: footNoteLinks.map((link, index) => {
            const textnode = footNotes[link]

            return {
              type: 'element',
              tagName: 'footnoteDefinition',
              children: textnode
                ? [textnode]
                : [
                    {
                      type: 'element',
                      tag: 'p',
                      children: [{ type: 'text', value: 'ERROR' }],
                    },
                  ],

              identifier: `${index + 1}`,
              label: `${index + 1}`,
            }
          }) || [
            {
              type: 'element',
              tag: 'p',
              children: [{ type: 'text', value: 'ERROR' }],
            },
          ],
        }

        const footsies = footNoteLinks?.length
          ? [...newTreeBeforeFootNotes.children, feet]
          : [...newTreeBeforeFootNotes.children]

        const newTree = {
          type: 'root',
          children: [
            {
              type: 'element',
              tagName: 'body',
              children: footsies,
            },
          ],
        }

        let cleanTitle = title.replaceAll(/\?/g, '')
        cleanTitle = cleanTitle.replaceAll(/\//g, ' and ')
        cleanTitle = cleanTitle.replaceAll(/\%/g, 'precentage')
        cleanTitle = cleanTitle.replaceAll(/Appendix /g, '')
        cleanTitle = cleanTitle.replaceAll(/\. /g, ' ')
        const { prefix, title: formattedTitle } = getPrefix(cleanTitle)
        const titles = formattedTitle || cleanTitle

        rehypeProcessor.run(newTree).then((f) => {
          const rawFile = rehypeProcessor.stringify(f)
          const formattedTitleWithDashes = titles?.replaceAll(/ /g, '-')
          const fileWithMetadata = `---\nslug: ${
            slug || formattedTitleWithDashes
          }\n---\n\n${String(rawFile)}`

          if (prefix.length > 3) {
            const directory = fs.readdirSync(dir)
            const ogFile = directory.find((file) => {
              const filePrefix = getPrefix(file).prefix
              return (
                filePrefix[0] === prefix[0] &&
                filePrefix[1] === prefix[1] &&
                filePrefix[2] === prefix[2]
              )
            })
            ogFile && fs.appendFileSync(`${dir}/${ogFile}`, rawFile)
            return
          }

          fs.writeFileSync(`${dir}/${cleanTitle}.md`, fileWithMetadata)
        })
      }

      if (isV7) {
        // Texinfo 7.2: strip a.copiable-link elements (contain ¶ pilcrow marks)
        visit(node, 'element', (el, index, parent) => {
          if (
            el.tagName === 'a' &&
            el.properties?.className?.includes('copiable-link') &&
            parent?.children
          ) {
            parent.children.splice(parent.children.indexOf(el), 1)
          }
        })

        // Texinfo 7.2: walk nested *-level-extent divs
        const alreadyDone = []
        const isLevelExtent = (el) =>
          el.type === 'element' &&
          el.tagName === 'div' &&
          el.properties?.className?.some((c) => c.includes('level-extent'))

        const processSection = (sectionDiv) => {
          const slug = sectionDiv.properties?.id || ''
          const children = sectionDiv.children.filter((c) => c.type === 'element')

          // Find the heading (first h1-h6 in direct children)
          const headingEl = children.find((c) =>
            ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(c.tagName)
          )

          // Collect content nodes: everything that is not a nav-panel, sub-level-extent, hr, mini-toc, or index anchor
          const contentNodes = sectionDiv.children.filter((c) => {
            if (c.type !== 'element') return false
            if (c.properties?.className?.includes('nav-panel')) return false
            if (isLevelExtent(c)) return false
            if (c.tagName === 'hr') return false
            if (c.properties?.className?.includes('mini-toc')) return false
            // Keep index anchors (a.index-entry-id) as they're harmless
            return true
          })

          if (headingEl) {
            headingEl.tagName = 'h2'
          }

          const headingText = headingEl
            ? replaceHeadings({ heading: toString(headingEl), headingObject })
            : 'empty'

          writeSection({
            contentNodes,
            slug,
            title: headingText,
            alreadyDone,
          })

          // Recurse into sub-level-extent children
          children.filter(isLevelExtent).forEach(processSection)
        }

        // Find the top-level-extent container
        visit(node, 'element', (el) => {
          if (!el.properties?.className?.includes('top-level-extent')) return

          // Extract top-level content (title, version, copyright) as the manual's root page
          const topContentNodes = el.children.filter((c) => {
            if (c.type !== 'element') return false
            if (isLevelExtent(c)) return false
            if (c.properties?.className?.includes('nav-panel')) return false
            if (c.properties?.className?.includes('region-contents')) return false
            if (c.tagName === 'hr') return false
            return true
          })
          const topHeading = topContentNodes.find((c) =>
            ['h1', 'h2', 'h3'].includes(c.tagName)
          )
          if (topHeading) {
            const topTitle = toString(topHeading)
            writeSection({
              contentNodes: topContentNodes,
              slug: 'Top',
              title: topTitle,
              alreadyDone,
            })
          }

          // Process chapter-level children
          el.children
            .filter((c) => c.type === 'element' && isLevelExtent(c))
            .forEach(processSection)
        })
      } else {
        // Texinfo 6.x: original flat div.header delimiter logic
        visit(node, 'element', (bod) => {
          if (
            ['auctex', 'magit'].includes(dir)
              ? bod.tagName !== 'body'
              : bod.properties?.id !== 'content'
          )
            return
          let nodes = []
          let firstHeader = null
          let slugId = ''

          let alreadyDone = []
          const content = bod.children

          content.forEach((item, index) => {
            const isHeader =
              dir !== 'auctex'
                ? item.tagName === 'div' &&
                  item.properties?.className?.includes('header')
                : item.tagName === 'table' &&
                  item?.properties?.cellSpacing == '1' &&
                  item?.properties?.cellPadding == '1' &&
                  item?.properties?.border == '0'

            if (!isHeader) {
              if (!slugId) {
                slugId =
                  content[index - 2]?.properties?.id ||
                  content[index - 5]?.properties?.name
              }
              if (
                ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(item.tagName) &&
                !firstHeader
              ) {
                firstHeader = item
                item.tagName = 'h2'
                const headerTitle = replaceHeadings({
                  heading: toString(item),
                  headingObject,
                })
                const pref = getPrefix(headerTitle).prefix
                if (pref.length === 4) {
                  nodes.push(item)
                }
                return
              }
              if (item.tagName === 'a' && !item?.properties?.href) return
              if (item.tagName === 'hr') return

              nodes.push(item)
              return
            }

            const title = firstHeader
              ? replaceHeadings({
                  heading: toString(firstHeader),
                  headingObject,
                })
              : 'empty'

            if (!firstHeader) return

            writeSection({
              contentNodes: nodes,
              slug: slugId,
              title,
              alreadyDone,
            })

            nodes = []
            firstHeader = null
            slugId = ''
          })
        })
      }
    })
}

const convertHtmlToMd = ({ file, filepath }) => {
  const tree = bigFileProcessor().parse(file)

  const dir = `${path.basename(filepath, '.html')}`

  const newProc = bigFileProcessor(tree, dir)
  newProc.data('type', dir)

  fs.existsSync(dir) || fs.mkdirSync(dir)

  newProc.run(tree).then((r) => console.log(r))
}

const parseLoop = (dir, filepath = null) => {
  if (!filepath) {
    const sub = fs.readdirSync(dir)
    sub.forEach((f) => parseLoop(dir, f))
    return
  }

  if (fs.lstatSync(path.join(dir, filepath)).isDirectory()) {
    const sub = fs.readdirSync(path.join(dir, filepath))
    sub.forEach((f) => parseLoop(dir, path.join(dir, filepath, f)))
    return
  }

  const file = fs.readFileSync(path.join(dir, filepath), {
    encoding: 'utf8',
  })

  if (['Index', '_'].some((thing) => filepath.includes(thing))) {
    badConverter({ filepath, file })
  }

  convertHtmlToMd({ file, filepath: path.join(dir, filepath) })
}
function main() {
  const filepath = process.argv[2] || '../raw_manuals/org.html'
  const file = fs.readFileSync(filepath, { encoding: 'utf8' })
  convertHtmlToMd({ file, filepath })
}

main()

export function getPrefix(str) {
  const [pref, title] = str
    .replaceAll(/(\w+\/)?([A-H\d\.]+) (.*?)/g, '$2@$3')
    .split('@')

  return { prefix: pref.split('.'), title }
}

//module.exports = { getPrefix }
