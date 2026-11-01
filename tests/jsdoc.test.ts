import { fileURLToPath } from 'node:url'
import type { Node } from 'typescript/ast'
import { isIdentifier, isObjectLiteralExpression, isPropertyAssignment, isVariableDeclaration } from 'typescript/ast/is'
import { API, type Project } from 'typescript/sync'
import { afterAll, describe, expect, test } from 'vitest'

const rootDirectory = fileURLToPath(new URL('..', import.meta.url))
const fixturePath = fileURLToPath(new URL('fixtures/jsdoc-routes.ts', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../tsconfig.test.json', import.meta.url))

const api = new API({ cwd: rootDirectory })
const snapshot = api.createSnapshot({ openProjects: [tsconfigPath] })

afterAll(() => api.close())

const collectDocs = (project: Project, node: Node, docs: Record<string, string>): void => {
  if (isPropertyAssignment(node) && isIdentifier(node.name) && isObjectLiteralExpression(node.parent)) {
    const contextualType = project.checker.getContextualType(node.parent)
    const property = contextualType && project.checker.getPropertyOfType(contextualType, node.name.text)
    docs[node.name.text] = property ? project.checker.getDocumentationCommentOfSymbol(property) : ''
  }
  node.forEachChild((child) => collectDocs(project, child, docs))
}

const docsAtCall = (variableName: string): Record<string, string> => {
  const project = snapshot.getConfiguredProject(tsconfigPath)
  const sourceFile = project?.program.getSourceFile(fixturePath)
  const docs: Record<string, string> = {}
  const visit = (node: Node): void => {
    if (isVariableDeclaration(node) && isIdentifier(node.name) && node.name.text === variableName && project) {
      collectDocs(project, node, docs)
      return
    }
    node.forEachChild(visit)
  }
  if (sourceFile) visit(sourceFile)
  return docs
}

describe('呼び出し側に定義の JSDoc が引き継がれる', () => {
  test('query のキー', () => {
    expect(docsAtCall('queryCall')).toMatchObject({ page: 'ページ', sort: '並び順' })
  })

  test('q で渡した query のキー', () => {
    expect(docsAtCall('queryShorthandCall')).toMatchObject({ page: 'ページ', sort: '並び順' })
  })

  test('メソッド経由で渡した query のキー', () => {
    expect(docsAtCall('methodCall')).toMatchObject({ page: 'ページ', sort: '並び順' })
  })

  test('params のキーと hash', () => {
    expect(docsAtCall('paramsAndHashCall')).toMatchObject({ id: 'ユーザー ID', hash: '見出し' })
  })

  test('p で渡した params のキー', () => {
    expect(docsAtCall('paramsShorthandCall')).toMatchObject({ id: 'ユーザー ID' })
  })
})
