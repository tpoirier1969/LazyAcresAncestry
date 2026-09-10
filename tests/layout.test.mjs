import assert from 'node:assert/strict';
import { layoutSample } from '../src/layout.js';

const people = [
  {id:'root',role:'root',branch:'center'},
  {id:'dad',role:'parent',branch:'paternal'},
  {id:'gpa',role:'grandparent',branch:'paternal',cluster:'p0'},
  ...Array.from({length:10},(_,i)=>({id:`s${i}`,role:'grandparent-sibling',branch:'paternal',cluster:'p0'})),
];
const radius=120;
const positions=layoutSample(people,radius);
assert.equal(positions.size, people.length);
const inverse = unit => {
  const theta=Math.acos(Math.max(-1,Math.min(1,-unit.z)));
  const s=Math.sin(theta); if(Math.abs(s)<1e-8)return {x:0,y:0};
  const d=radius*theta; return {x:d*unit.x/s,y:d*unit.y/s};
};
const root=inverse(positions.get('root'));
const dad=inverse(positions.get('dad'));
const gpa=inverse(positions.get('gpa'));
assert.ok(dad.y > root.y + 2);
assert.ok(gpa.y > dad.y + 2);
const siblingYs=Array.from({length:10},(_,i)=>inverse(positions.get(`s${i}`)).y);
assert.ok(Math.max(...siblingYs)-Math.min(...siblingYs) < 1.5, 'same-generation sibling wraps stay in a narrow band');
console.log('layout generation bands ok');
