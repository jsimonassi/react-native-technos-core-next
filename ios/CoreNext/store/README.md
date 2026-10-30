# `store/` (iOS)

Histórico local e pareamento salvo. Par do `store/` do Android, com o mesmo formato de arquivo.

## Tipos

| Tipo | Papel |
|---|---|
| `FileSampleStore` | `SampleStore` em `Application Support/corenext/{steps,sleep,confirmed-steps,confirmed-sleep}.json`. Escrita atômica (`Data.write(options: .atomic)`); arquivo ilegível vira lista vazia com `WARN`; item inválido é pulado e contado. |
| `SampleJsonCodec` | `{"version":1,"items":[...]}` com os nomes das propriedades do domínio, igual ao `SampleJsonCodec` do Android. |
| `PairingStore` | Último relógio que chegou a `READY` (`address`, `profileId`, `name`) numa suíte própria do `UserDefaults` (`br.com.grupotechnos.corenext.pairing`). As três chaves são lidas e gravadas sob uma trava: o `CoreBridge` grava na thread da sessão e lê de outras, e um `load` no meio de um `save` não pode misturar dois relógios (o Android tem um único `edit()...apply()`). |

## Regras

- **Nunca** apagar o `UserDefaults` do app: o Core iOS atual faz `removePersistentDomainForName` no
  `disconnectCurrentDevice` (`TechnosWareCore/ios/smaBluetooth/SMAService.m:148-149`) e leva junto as preferências do
  app. O `PairingStore.clear` remove só as três chaves da suíte dele.
- O `address` é o UUID do `CBPeripheral`, que muda se o app for reinstalado: o pareamento salvo não sobrevive a uma
  reinstalação (o histórico em `Application Support` também não).
- Quando gravar e apagar é decisão do `CoreBridge` (Repo 1); aqui só se executa.

## Testes

`StoreAndLogTests` (`../../Tests/`): ida e volta e nova instância, arquivo corrompido, a suíte que não toca no
`UserDefaults.standard`, o `PairingStore` sob gravação e leitura concorrentes sem pareamento misturado. O replay completo (`CoreBridgeReplayTests`) confere o pareamento gravado no `READY` e apagado
no `forgetDevice` com uma chave do app intacta.
