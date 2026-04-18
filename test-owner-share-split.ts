import assert from 'node:assert/strict'
import { buildOwnerSharesFromLots } from './src/lib/owner-share'

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0)
}

function testBorrowerPriority() {
  const shares = buildOwnerSharesFromLots({
    rentalItemTotalPrice: 40,
    rentedQuantity: 5,
    borrowerUserId: 'lukas',
    lots: [
      {
        label: 'Lukas exklusiv',
        units: 4,
        shares: [{ ownerId: 'lukas', fraction: 1 }]
      },
      {
        label: 'Shared',
        units: 6,
        shares: [
          { ownerId: 'lukas', fraction: 0.5 },
          { ownerId: 'witiko', fraction: 0.5 }
        ]
      }
    ]
  })
  assert.equal(shares.length, 2)
  const lukas = shares.find((s) => s.ownerId === 'lukas')
  const witiko = shares.find((s) => s.ownerId === 'witiko')
  assert.equal(lukas?.shareAmount, 36)
  assert.equal(witiko?.shareAmount, 4)
}

function testRoundingToCents() {
  const shares = buildOwnerSharesFromLots({
    rentalItemTotalPrice: 10,
    rentedQuantity: 3,
    lots: [
      {
        units: 3,
        shares: [
          { ownerId: 'a', fraction: 1 / 3 },
          { ownerId: 'b', fraction: 1 / 3 },
          { ownerId: 'c', fraction: 1 / 3 },
        ]
      }
    ]
  })
  const total = sum(shares.map((s) => s.shareAmount))
  assert.equal(total, 10)
}

function testInvalidOwnership() {
  assert.throws(() => buildOwnerSharesFromLots({
    rentalItemTotalPrice: 80,
    rentedQuantity: 8,
    lots: [{ units: 8, shares: [{ ownerId: 'lukas', fraction: 0.7 }] }]
  }))
}

testBorrowerPriority()
testRoundingToCents()
testInvalidOwnership()
console.log('owner share split tests passed')
