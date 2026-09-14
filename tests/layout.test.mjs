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
assert.ok(Math.abs((dad.y-root.y)-2.48)<0.02, 'root-to-parent band keeps the approved spacing');
assert.ok(gpa.y-dad.y > 2.9, 'grandparent band compensates for perspective compression');
const siblingYs=Array.from({length:10},(_,i)=>inverse(positions.get(`s${i}`)).y);
assert.ok(Math.max(...siblingYs)-Math.min(...siblingYs) <= 1.34, 'wrapped peers use the same spacing in each row');
console.log('layout generation bands ok');
