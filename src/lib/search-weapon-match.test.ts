import {expect,it} from 'vitest';
import {weaponMatchMultiplier} from './search-weapon-match';

it('downranks explicitly different weapons without filtering unknown or mixed contexts',()=>{
	expect(weaponMatchMultiplier('давление мечом','Рапира: работа с клинком')).toBeLessThan(1);
	expect(weaponMatchMultiplier('перевод рапирой','Сабельный семинар')).toBeLessThan(1);
	expect(weaponMatchMultiplier('работа саблей','Сабельное фехтование')).toBe(1);
	expect(weaponMatchMultiplier('давление мечом','Длинный меч')).toBe(1);
	expect(weaponMatchMultiplier('соединение клинков','Рапира')).toBe(1);
	expect(weaponMatchMultiplier('движение мечом','Общая методика')).toBe(1);
	expect(weaponMatchMultiplier('рапира против сабли','Сабля')).toBe(1);
	expect(weaponMatchMultiplier('атака мячом','Рапира')).toBe(1);
	expect(weaponMatchMultiplier('мечта спортсмена','Рапира')).toBe(1);
});
