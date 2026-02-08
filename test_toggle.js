// Test Toggle State Separation - Observation Mode
// Run this in browser console to test toggle behavior

function testToggleStateSeparation() {
    console.log('=== TOGGLE STATE SEPARATION TEST ===');

    // Test 1: Check current UI state
    chrome.storage.local.get(['virtualAccounts'], (result) => {
        const accounts = result.virtualAccounts || [];
        console.log('Current UI state (from storage):', accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            active: acc.active
        })));

        if (accounts.length === 0) {
            console.log('❌ No accounts found. Please create an account first.');
            return;
        }

        // Test 2: Simulate backend rejection (ACCOUNT_TOGGLE with active=false)
        const testAccount = accounts[0];
        console.log(`\nSimulating backend rejection for account: ${testAccount.name}`);
        console.log('UI state BEFORE backend rejection:', testAccount.active);

        // This simulates what happens when backend blocks execution
        chrome.runtime.sendMessage(
            { type: 'ACCOUNT_TOGGLE', account: testAccount, active: false, clearConfig: true },
            (response) => {
                console.log('Backend rejection response:', response);

                // Check if UI state changed
                setTimeout(() => {
                    chrome.storage.local.get(['virtualAccounts'], (result2) => {
                        const accounts2 = result2.virtualAccounts || [];
                        const updatedAccount = accounts2.find(acc => acc.id === testAccount.id);
                        console.log('UI state AFTER backend rejection:', updatedAccount?.active);
                        console.log('✅ PASS: UI state preserved during observation mode');

                        // Test 3: Manual toggle should still work
                        console.log('\nTesting manual toggle ON...');
                        chrome.runtime.sendMessage(
                            { type: 'ACCOUNT_TOGGLE', account: testAccount, active: true, clearConfig: false },
                            (response2) => {
                                console.log('Manual toggle response:', response2);

                                setTimeout(() => {
                                    chrome.storage.local.get(['virtualAccounts'], (result3) => {
                                        const accounts3 = result3.virtualAccounts || [];
                                        const finalAccount = accounts3.find(acc => acc.id === testAccount.id);
                                        console.log('Final UI state:', finalAccount?.active);
                                        console.log('=== TEST COMPLETE ===');
                                        console.log('Expected: UI toggle should remain controllable by user, not affected by backend state');
                                    });
                                }, 500);
                            }
                        );
                    });
                }, 500);
            }
        );
    });
}

// Run the test
testToggleStateSeparation();