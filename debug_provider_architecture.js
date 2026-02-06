/**
 * DEBUG PROVIDER ARCHITECTURE v1.0
 * 
 * Jalankan di Console browser (F12) untuk masing-masing akun.
 * Script ini akan menangkap semua XHR/Fetch dan WebSocket traffic
 * untuk memahami arsitektur data provider.
 */

(function() {
    console.log('🔍 DEBUG PROVIDER ARCHITECTURE v1.0 STARTED');
    console.log('='.repeat(60));
    
    // Storage untuk captured data
    window.__DEBUG_CAPTURE = {
        xhr: [],
        fetch: [],
        websocket: [],
        oddsData: []
    };
    
    // ========================================
    // 1. INTERCEPT XHR
    // ========================================
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this.__debugUrl = url;
        this.__debugMethod = method;
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
        const xhr = this;
        const url = this.__debugUrl || '';
        
        // Filter for odds-related URLs
        const isOddsRelated = url.includes('odds') || 
                              url.includes('match') || 
                              url.includes('sport') ||
                              url.includes('bet') ||
                              url.includes('api') ||
                              url.includes('getmatch') ||
                              url.includes('live');
        
        if (isOddsRelated) {
            console.log(`📤 XHR ${this.__debugMethod}: ${url.substring(0, 100)}`);
            
            this.addEventListener('load', function() {
                try {
                    let responseData = xhr.responseText;
                    if (responseData && responseData.length < 50000) {
                        const parsed = JSON.parse(responseData);
                        
                        // Log summary
                        console.log(`📥 XHR Response from: ${url.substring(0, 60)}`);
                        console.log(`   Keys: ${Object.keys(parsed).slice(0, 10).join(', ')}`);
                        
                        // Detect odds patterns
                        const responseStr = JSON.stringify(parsed);
                        if (responseStr.includes('odds') || responseStr.includes('home') || responseStr.includes('away')) {
                            console.log(`   🎯 ODDS DATA DETECTED!`);
                            window.__DEBUG_CAPTURE.oddsData.push({
                                url: url,
                                type: 'xhr',
                                sample: parsed,
                                timestamp: new Date().toISOString()
                            });
                        }
                        
                        window.__DEBUG_CAPTURE.xhr.push({
                            url: url,
                            method: xhr.__debugMethod,
                            response: parsed,
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch(e) {}
            });
        }
        
        return originalXHRSend.apply(this, arguments);
    };
    
    // ========================================
    // 2. INTERCEPT FETCH
    // ========================================
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        
        const isOddsRelated = url.includes('odds') || 
                              url.includes('match') || 
                              url.includes('sport') ||
                              url.includes('bet') ||
                              url.includes('api') ||
                              url.includes('getmatch') ||
                              url.includes('live');
        
        if (isOddsRelated) {
            console.log(`🌐 FETCH: ${url.substring(0, 100)}`);
        }
        
        const response = await originalFetch.apply(this, arguments);
        
        if (isOddsRelated) {
            // Clone to read body
            const clone = response.clone();
            try {
                const data = await clone.json();
                console.log(`📥 FETCH Response: ${url.substring(0, 60)}`);
                
                const responseStr = JSON.stringify(data);
                if (responseStr.includes('odds') || responseStr.includes('home') || responseStr.includes('away')) {
                    console.log(`   🎯 ODDS DATA DETECTED!`);
                    window.__DEBUG_CAPTURE.oddsData.push({
                        url: url,
                        type: 'fetch',
                        sample: data,
                        timestamp: new Date().toISOString()
                    });
                }
                
                window.__DEBUG_CAPTURE.fetch.push({
                    url: url,
                    response: data,
                    timestamp: new Date().toISOString()
                });
            } catch(e) {}
        }
        
        return response;
    };
    
    // ========================================
    // 3. INTERCEPT WEBSOCKET
    // ========================================
    const OriginalWebSocket = window.WebSocket;
    
    window.WebSocket = function(url, protocols) {
        console.log(`🔌 WebSocket CONNECT: ${url}`);
        
        const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
        
        // Track messages
        const originalOnMessage = ws.onmessage;
        let messageCount = 0;
        
        ws.addEventListener('message', function(event) {
            messageCount++;
            
            // Only log every 10th message or first 5
            if (messageCount <= 5 || messageCount % 10 === 0) {
                try {
                    let data = event.data;
                    if (typeof data === 'string' && data.length < 10000) {
                        const parsed = JSON.parse(data);
                        console.log(`📨 WS[${messageCount}]: ${url.substring(0, 40)}...`);
                        
                        const dataStr = JSON.stringify(parsed);
                        if (dataStr.includes('odds') || dataStr.includes('home') || dataStr.includes('hdp') || dataStr.includes('HDP')) {
                            console.log(`   🎯 ODDS WEBSOCKET DATA!`);
                            console.log(`   Sample keys: ${Object.keys(parsed).slice(0, 5).join(', ')}`);
                            
                            window.__DEBUG_CAPTURE.websocket.push({
                                url: url,
                                data: parsed,
                                timestamp: new Date().toISOString()
                            });
                            
                            window.__DEBUG_CAPTURE.oddsData.push({
                                url: url,
                                type: 'websocket',
                                sample: parsed,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                } catch(e) {}
            }
        });
        
        return ws;
    };
    
    // Copy static properties
    Object.keys(OriginalWebSocket).forEach(key => {
        window.WebSocket[key] = OriginalWebSocket[key];
    });
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    
    // ========================================
    // 4. HELPER FUNCTIONS
    // ========================================
    
    // Function to show summary
    window.showDebugSummary = function() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 DEBUG CAPTURE SUMMARY');
        console.log('='.repeat(60));
        console.log(`XHR Requests: ${window.__DEBUG_CAPTURE.xhr.length}`);
        console.log(`Fetch Requests: ${window.__DEBUG_CAPTURE.fetch.length}`);
        console.log(`WebSocket Messages: ${window.__DEBUG_CAPTURE.websocket.length}`);
        console.log(`Odds Data Found: ${window.__DEBUG_CAPTURE.oddsData.length}`);
        
        if (window.__DEBUG_CAPTURE.oddsData.length > 0) {
            console.log('\n🎯 ODDS DATA SOURCES:');
            const sources = new Set(window.__DEBUG_CAPTURE.oddsData.map(d => d.url));
            sources.forEach(url => {
                console.log(`   - ${url.substring(0, 80)}`);
            });
        }
        
        return window.__DEBUG_CAPTURE;
    };
    
    // Function to export data
    window.exportDebugData = function() {
        const blob = new Blob([JSON.stringify(window.__DEBUG_CAPTURE, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug_capture_${Date.now()}.json`;
        a.click();
    };
    
    // Function to check extension connection
    window.checkExtension = function() {
        if (window.__SABA_EXT_INJECTED) {
            console.log('✅ Extension IS injected');
            console.log(`   Account: ${window.__SABA_ACCOUNT || 'unknown'}`);
        } else {
            console.log('❌ Extension NOT injected!');
        }
    };
    
    console.log('');
    console.log('📌 AVAILABLE COMMANDS:');
    console.log('   showDebugSummary()  - Show captured data summary');
    console.log('   exportDebugData()   - Export all captured data to JSON');
    console.log('   checkExtension()    - Check if extension is active');
    console.log('');
    console.log('⏳ Waiting for network traffic...');
    console.log('   (Navigate/refresh the odds page to capture data)');
    console.log('='.repeat(60));
})();
