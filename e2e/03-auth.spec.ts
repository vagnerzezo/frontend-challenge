import { expect, isMobile, login, mocks, test, USERS, useScenario } from './fixtures'
import type { Page } from '@playwright/test'

async function logout(page: Page) {
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByText('Você saiu da sua conta.').first()).toBeVisible()
}

test.describe('3. Cadastro, login, expiração, logout e troca de usuário', () => {
  test.beforeEach(async ({ page }) => useScenario(page))

  test('cadastro com validação, conflito e sucesso', async ({ page }) => {
    await page.goto('/cadastro')
    await page.getByRole('button', { name: 'Criar conta' }).filter({ visible: true }).last().click()
    await expect(page.getByText('Use ao menos 3 caracteres.')).toBeVisible()
    await expect(page.getByText('E-mail é obrigatório.')).toBeVisible()

    await page.getByPlaceholder('Nome de usuário').fill('novacolecionadora')
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill(USERS.nova.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('senha1234')
    await page.getByPlaceholder('Confirmar senha').fill('senha9999')
    await page.getByRole('button', { name: 'Criar conta' }).filter({ visible: true }).last().click()
    await expect(page.getByText('As senhas não conferem.')).toBeVisible()

    await page.getByPlaceholder('Confirmar senha').fill('senha1234')
    await page.getByRole('button', { name: 'Criar conta' }).filter({ visible: true }).last().click()
    // conflito retornado pela API, associado ao campo
    const email = page.getByPlaceholder('Digite seu e-mail', { exact: true })
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    await email.fill('nova.conta@kurio.dev')
    await page.getByRole('button', { name: 'Criar conta' }).filter({ visible: true }).last().click()
    await expect(page.getByText('Conta criada. Bem-vindo, novacolecionadora.').first()).toBeVisible()
    await page.reload()
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('novacolecionadora')
  })

  test('login inválido, sucesso e retorno ao fluxo anterior; sessão sobrevive a refresh', async ({ page }) => {
    await page.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil%2Fcarteiras/)
    await page.getByPlaceholder('contato@email.com').fill('email-invalido')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
    await page.getByPlaceholder('contato@email.com').fill(USERS.nova.email)
    await page.getByPlaceholder('Senha').fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await page.getByPlaceholder('Senha').fill(USERS.nova.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('expiração de sessão durante a navegação preserva o destino', async ({ page }) => {
    await login(page)
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Nova Sato')
    await mocks(page).expireSessions()
    await page.getByRole('link', { name: /Carteiras/ }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fperfil%2Fcarteiras&reason=expired/)
    await expect(page.locator('p[role=alert]').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
    await page.getByPlaceholder('contato@email.com').fill(USERS.nova.email)
    await page.getByPlaceholder('Senha').fill(USERS.nova.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('logout e troca de usuário não expõem dados do usuário anterior', async ({ page }) => {
    await login(page, USERS.nova)
    await page.goto('/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid').getByText('Emerald Ape #042')).toBeVisible()
    await logout(page)
    // rota privada após logout
    await page.goto('/perfil/favoritos')
    await expect(page).toHaveURL(/\/login/)

    await login(page, USERS.ravi, '/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Nenhum favorito ainda' })).toBeVisible()
    await page.goto('/perfil')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ravi Lemos')
    await page.goto('/perfil/carteiras')
    await expect(page.getByLabel('Apelido da carteira').first()).toHaveValue('Cofre')
    if (!isMobile(page)) await expect(page.getByRole('link', { name: 'Meu perfil, Ravi Lemos' })).toBeVisible()
  })
})
