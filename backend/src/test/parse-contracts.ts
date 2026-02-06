import { parseProvider } from '../contracts';

function run() {
    const sampleSaba = JSON.stringify({ d: { MatchList: [{ MatchId: 12345, HomeName: 'Team A', AwayName: 'Team B', Odds: [1.5, 2.5] }] } });
    const sampleSaba2 = JSON.stringify({ d: { MatchList: [{ MatchId: 22222, HomeName: 'Home X', AwayName: 'Away Y', Markets: [{ Odds: [{ Price: '1.35' }, { Price: '3.50' }, { Price: '2.80' }] }] }] } });
    const sampleSaba3 = JSON.stringify({ MatchList: [{ MatchId: 'M-333', HomeName: 'Foo', AwayName: 'Bar', Prices: [{ price: '1,45' }, { price: '2,60' }] }] });
    const sampleSabaWithIds = JSON.stringify({ d: { MatchList: [{ MatchId: 77777, HomeName: 'HomeID', AwayName: 'AwayID', Markets: [{ Selections: [{ SelectionId: 'S1', Name: 'HomeID', Price: '1.40' }, { SelectionId: 'S2', Name: 'AwayID', Price: '2.80' }] }] }] }, sinfo: 'ABC123' });
    const sampleAfb = JSON.stringify({ data: { MatchList: [{ MatchId: 54321, home: 'Alpha', away: 'Beta', odds: [1.8, 2.0] }] } });

    console.log('== SABA sample parse (basic) ==');
    const sRes = parseProvider('SABA', sampleSaba);
    console.log(JSON.stringify(sRes, null, 2));

    console.log('\n== SABA sample parse (markets/prices) ==');
    const sRes2 = parseProvider('SABA', sampleSaba2);
    console.log(JSON.stringify(sRes2, null, 2));

    console.log('\n== SABA sample parse (comma decimals) ==');
    const sRes3 = parseProvider('SABA', sampleSaba3);
    console.log(JSON.stringify(sRes3, null, 2));

    console.log('\n== SABA sample parse (with selection ids) ==');
    const sRes4 = parseProvider('SABA', sampleSabaWithIds);
    console.log(JSON.stringify(sRes4, null, 2));

    console.log('\n== AFB88 sample parse ==');
    const aRes = parseProvider('AFB88', sampleAfb);
    console.log(JSON.stringify(aRes, null, 2));
}

run();
