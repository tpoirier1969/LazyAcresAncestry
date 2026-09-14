import assert from 'node:assert/strict';
import { layoutSample } from '../src/layout.js';

const people = [
  {id:'root',role:'root',branch:'center'},
  {id:'dad',role:'parent',branch:'paternal'},
  {id:'gpa',role:'grandparent',branch:'paternal',cluster:'p0'},
  {id:'gma',role:'grandparent',branch:'paternal',cluster:'p1'},
  ...Array.from({length:10},(_,i)=>({id:`s${i}`,role:'grandparent-sibling',branch:'paternal',cluster:i<7?'p0':'p1'})),
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

const generation = people
  .filter(person => person.role === 'grandparent' || person.role === 'grandparent-sibling')
  .map(person => ({ id: person.id, point: inverse(positions.get(person.id)) }));
let minimum = Infinity;
for (let i=0;i<generation.length;i+=1) {
  for (let j=i+1;j<generation.length;j+=1) {
    minimum=Math.min(minimum,Math.hypot(
      generation[i].point.x-generation[j].point.x,
      generation[i].point.y-generation[j].point.y,
    ));
  }
}
assert.ok(minimum > 1.42, `visible generation spacing collapsed to ${minimum.toFixed(3)}`);
console.log('layout generation bands and uniform spacing ok');
