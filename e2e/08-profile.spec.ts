import { expect, login, test, useMockConfig } from './fixtures'
import path from 'node:path'

test.describe('8. Perfil, avatar, senha e carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await useMockConfig(page)
    await login(page)
  })

  test('edição do perfil com validação e erro da API, persistindo após refresh', async ({ page }) => {
    await page.goto('/perfil')
    const username = page.getByLabel('Nome de usuário')
    await username.fill('Inválido!')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Use apenas letras minúsculas, números, ponto ou _.')).toBeVisible()
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    // conflito vindo da API
    await username.fill('ravilemos')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()
    await username.fill('nova.sato')
    await page.getByLabel('Nome de exibição').fill('Nova S.')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Alterações salvas.').first()).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Nova S.')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('nova.sato')
  })

  test('avatar: envio e remoção', async ({ page }) => {
    await page.goto('/perfil')
    await page.getByTestId('avatar-input').setInputFiles(path.resolve('public/nfts/golden-beat.webp'))
    await expect(page.getByTestId('avatar-image')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-image')).toBeVisible()
    await page.getByRole('button', { name: 'Remover', exact: true }).click()
    await expect(page.getByRole('img', { name: 'Sem avatar' })).toBeVisible()
  })

  test('alteração de senha com erro de senha atual e sucesso', async ({ page }) => {
    await page.goto('/perfil')
    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha123')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('As senhas não conferem.')).toBeVisible()
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha123')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()
    await page.getByLabel('Senha atual').fill('Kurio@2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Alterações salvas.').first()).toBeVisible()
    // nova senha vale no próximo login
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByText('Você saiu da sua conta.').first()).toBeVisible()
    await page.goto('/login')
    await page.getByPlaceholder('contato@email.com').fill('colecionador@kurio.dev')
    await page.getByPlaceholder('Senha').fill('NovaSenha123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('Bem-vindo de volta, Nova Sato.').first()).toBeVisible()
  })

  test('carteiras: validação, edição da principal e cadastro da secundária', async ({ page }) => {
    await page.goto('/perfil/carteiras')
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await primary.getByLabel('Endereço da carteira').fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText(/Endereço deve começar com 0x/)).toBeVisible()
    await primary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await primary.getByLabel('Apelido da carteira').fill('Cofre principal')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Cofre principal')

    // usuário 1 já tem secundária; edita e salva
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await secondary.getByLabel('Código de indicação').fill('!!')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Use 4–20 letras, números ou hífen.')).toBeVisible()
    await secondary.getByLabel('Código de indicação').fill('KURIO-2026')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.').first()).toBeVisible()
  })
})
