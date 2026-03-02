# Caixinha Comunitária - TODO

## Funcionalidades Implementadas
- [x] Sistema de participantes com empréstimos
- [x] Cálculo de juros (10% ao mês)
- [x] Histórico de transações
- [x] Dashboard com estatísticas
- [x] Banco de dados MySQL
- [x] Autenticação OAuth
- [x] Adicionar novo participante
- [x] Adicionar empréstimo adicional
- [x] Amortização de dívida
- [x] Resetar mês

## Funcionalidades em Desenvolvimento
- [x] Corrigir sistema de pagamentos para múltiplos pagamentos por mês
- [x] Adicionar indicador visual de meses pagos
- [ ] Permitir alterar mês de pagamento já registrado

## Funcionalidades Futuras
- [ ] Relatório PDF mensal
- [ ] Deletar participante
- [ ] Gráfico de evolução de dívida
- [ ] Filtro de histórico por data
- [ ] Exportação CSV

## Correções em Andamento
- [x] Remover restrição do botão "Pagar Mensal" para permitir pagamentos sempre

## Correções Financeiras
- [x] Corrigir cálculo de arrecadação: R$ 200 (cota) + juros (10%) separados
- [x] Amortização deve ir para Cotas Arrecadadas
- [x] Atualizar dashboard para mostrar valores corretos

## Novas Funcionalidades
- [x] Editar valor total emprestado por participante
- [x] Editar valor arrecadado (cotas + juros)

## Melhorias de Interface
- [x] Melhorar visibilidade dos botões de edição (Empréstimo e Saldo)
- [x] Adicionar botão para editar nome do participante
- [x] Adicionar botão para deletar participante

## Melhorias de Fluidez
- [x] Atualizar dashboard em tempo real quando pagamento é registrado
- [x] Atualizar dashboard em tempo real quando amortização é registrada
- [x] Invalidar cache de queries automaticamente após mutações

## Funcionalidades Offline
- [x] Implementar sincronização com localStorage
- [x] Salvar dados localmente quando offline
- [x] Indicador visual de status online/offline
- [ ] Sincronizar com servidor quando voltar online (em progresso)

## Verificação de Fórmula
- [x] Confirmar que juros são 10% sobre saldo devedor (não valor inicial)
- [x] Testar cálculo de mensalidade: Cota (R$ 200) + Juros (10% do saldo)

## Backup e Exportação
- [x] Implementar função de exportação para CSV
- [x] Criar botão de download no dashboard
- [x] Incluir participantes, transações e histórico no CSV

## Importação de Dados
- [x] Implementar função de importação de CSV
- [x] Criar modal de upload de arquivo
- [x] Validar e restaurar dados do backup
- [x] Mostrar confirmação antes de restaurar

## Gráficos e Visualizações
- [x] Implementar gráfico de evolução de dívida por participante
- [x] Adicionar modal com gráfico ao card do participante
- [x] Usar Recharts para visualização
- [x] Mostrar tendência de pagamento/amortização

## Atualizações Finais
- [x] Adicionar card de Total Arrecadado (Cotas + Juros)
- [x] Atualizar ano para 2026 no indicador de meses

## Visualização de Débitos
- [x] Criar seção de "Quem Deve" com lista de devedores
- [x] Mostrar saldo devedor por empréstimo
- [x] Ordenar por maior dívida
- [x] Incluir status visual (cores)

## Implementações Finais (v2.1)
- [x] Implementar grid de 12 meses no modal de histórico
- [x] Corrigir exportação CSV com todos os dados necessários
- [x] Testar ciclo completo de exportação e importação

## Validação de Pagamento Duplicado (v2.2)
- [x] Validar no backend para impedir pagamento do mesmo mês duas vezes
- [x] Adicionar feedback visual quando mês já foi pago
- [x] Testar fluxo de pagamento com validação

## Desmarcar Pagamento e Auditoria (v2.3)
- [x] Criar tabela de auditoria no schema
- [x] Implementar endpoint para desmarcar pagamento
- [x] Adicionar botão de desmarcar no modal de histórico
- [x] Criar visualização do histórico de alterações
- [x] Testar fluxo completo

## Seletor de Ano para Pagamentos (v2.4)
- [x] Adicionar seletor de ano no MonthsGrid
- [x] Permitir navegação entre anos
- [x] Atualizar visualização de meses pagos por ano

## Correção de Bugs (v2.5)
- [x] Corrigir ParticipantCard - Reorganizar layout do header
- [x] Corrigir MonthsGrid - Usar ano atual como padrão

## Formatação Consistente de Valores (v2.6)
- [x] Criar função formatCurrency() centralizada
- [x] Aplicar em ParticipantCard
- [x] Aplicar em Home.tsx e componentes
- [x] Testar formatação em toda aplicação

## Correção ParticipantCard Meses (v2.7)
- [x] Adicionar seletor de ano no ParticipantCard para visualizar meses pagos de diferentes anos

## Scroll Suave no Histórico (v2.8)
- [x] Adicionar botões de scroll suave no modal de histórico

## Feedback de Sucesso Consistente (v2.9)
- [x] Criar utilitário de toast padronizado
- [x] Aplicar toasts em todas as ações

## Modal de Confirmação para Ações Destrutivas (v3.0)
- [x] Criar componente ConfirmationModal reutilizável
- [x] Integrar em deletar participante
- [x] Integrar em resetar mês

## Melhorias no Fluxo de Desmarcar Mês (v3.1)
- [x] Adicionar modal de confirmação ao desmarcar mês
- [x] Atualizar valores na página principal após desmarcar
- [x] Alinhar layout do histórico e auditoria

## Atualização em Tempo Real de Valores (v3.2)
- [x] Implementar desmarcar pagamento no dashboard principal (ParticipantCard)
- [x] Adicionar confirmação modal ao desmarcar no dashboard
- [x] Sincronizar valores totais (cotas, juros, dívidas) após desmarcar
- [x] Refletir mudanças no modal de histórico em tempo real

## Accordion/Collapse no ParticipantCard (v3.3)
- [x] Adicionar estado de collapse ao ParticipantCard
- [x] Implementar visualização compacta (nome + dívida)
- [x] Implementar transição suave entre estados
- [x] Testar funcionalidade de collapse/expand
## Correção de Bugs (v3.4)
- [x] Remover console.log de debug do routers.ts
- [x] Padronizar tratamento de erro para banco indisponível

## Validação de Amortização (v3.5)
- [x] Validar amortização - impedir amortizar mais que a dívida atual

## Confirmação de Deleção (v3.6)
- [x] Implementar modal de confirmação para deletar participante

## Otimização para Mobile (v3.7)
- [x] Otimizar layout para telas pequenas
- [x] Melhorar navegação em celular
- [x] Ajustar tamanho de botões e inputs para toque
- [x] Testar responsividade em diferentes dispositivos

## PWA e Compartilhamento em Tempo Real (v3.8)
- [x] Configurar PWA com service worker
- [x] Implementar sincronização em tempo real (WebSocket)
- [x] Adicionar sistema de permissões e compartilhamento
- [x] Implementar notificações push
- [x] Testar sincronização entre múltiplos usuários

## Sistema de Email de Confirmação (v3.9)
- [x] Configurar provedor de email
- [x] Criar template de email
- [x] Implementar função para enviar email
- [x] Integrar ao registrar pagamento
- [x] Adicionar UI para configurar email
- [x] Testar envio de emails

## Edição de Email de Participante (v4.0)
- [x] Implementar procedimento tRPC para editar email
- [x] Criar modal para editar email
- [x] Adicionar botão de editar email no ParticipantCard
- [x] Testar edição de email

## Teste e Correção de Envio de Email (v4.1)
- [x] Corrigir configuração de email no Resend
- [x] Testar envio com email de teste
- [x] Adicionar logs para debug
- [x] Email enviado com sucesso para jvdcx.cic22@uea.edu.br
