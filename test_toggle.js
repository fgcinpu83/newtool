// Test Toggle Function
// Run this in browser console to test toggle functionality

function testToggle() {
    console.log('=== TOGGLE FUNCTION TEST ===');

    // Test 1: Check if accounts exist
    chrome.storage.local.get(['virtualAccounts'], (result) => {
        const accounts = result.virtualAccounts || [];
        console.log('Found accounts:', accounts.length);

        if (accounts.length === 0) {
            console.log('❌ No accounts found. Please create an account first.');
            return;
        }

        accounts.forEach(acc => {
            console.log(`Account: ${acc.name} (ID: ${acc.id}, Active: ${acc.active})`);
        });

        // Test 2: Try to toggle first account
        const testAccount = accounts[0];
        console.log(`\nTesting toggle for account: ${testAccount.name}`);

        // Simulate toggle ON
        console.log('Simulating toggle ON...');
        chrome.runtime.sendMessage(
            { type: 'ACCOUNT_TOGGLE', account: testAccount, active: true, clearConfig: false },
            (response) => {
                console.log('Toggle ON response:', response);

                // Wait 2 seconds then toggle OFF
                setTimeout(() => {
                    console.log('Simulating toggle OFF...');
                    chrome.runtime.sendMessage(
                        { type: 'ACCOUNT_TOGGLE', account: testAccount, active: false, clearConfig: true },
                        (response) => {
                            console.log('Toggle OFF response:', response);
                            console.log('=== TEST COMPLETE ===');
                        }
                    );
                }, 2000);
            }
        );
    });
}

// Run the test
testToggle();