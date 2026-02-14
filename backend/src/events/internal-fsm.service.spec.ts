import { InternalFsmService, ToggleState } from './internal-fsm.service'

describe('InternalFsmService (basic)', () => {
  let fsm: InternalFsmService

  beforeEach(() => {
    fsm = new InternalFsmService()
  })

  test('initial states are IDLE and statusSnapshot reflects both accounts', () => {
    expect(fsm.get('A')).toBe(ToggleState.IDLE)
    expect(fsm.get('B')).toBe(ToggleState.IDLE)
    const snap = fsm.statusSnapshot()
    expect(snap).toEqual({ A: ToggleState.IDLE, B: ToggleState.IDLE })
  })

  test('transition throws when caller is not WorkerService', () => {
    expect(() => fsm.transition('A', ToggleState.STARTING)).toThrow('FSM mutation only allowed from WorkerService')
  })

  test('transition succeeds when invoked from a function named WorkerService (stack check)', () => {
    function WorkerServiceInvoker() {
      // named function ensures its name appears in the error.stack when inspected
      return fsm.transition('A', ToggleState.STARTING)
    }

    // Should not throw
    expect(() => WorkerServiceInvoker()).not.toThrow()
    expect(fsm.get('A')).toBe(ToggleState.STARTING)
  })
})
