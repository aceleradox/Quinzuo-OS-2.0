;; Capacidade Cognitiva 5.8 — kernel simulado em WebAssembly
;; Fonte legível. O binário é gerado por tools/build-cognitive-kernel.js

(module
  (memory (export "memory") 1)

  (global $base (mut f32) (f32.const 5.8))     ;; capacidade base
  (global $cortex (mut f32) (f32.const 0.58))  ;; ativação do córtex pré-frontal
  (global $impulso (mut f32) (f32.const 0.5))  ;; estabilidade emocional
  (global $ciclos (mut i32) (i32.const 0))     ;; ciclos simulados

  (func (export "versao") (result i32)
    (i32.const 58))

  (func (export "capacidade_base") (result f32)
    (global.get $base))

  (func (export "definir_cortex") (param f32)
    (global.set $cortex (local.get 0)))

  (func (export "ler_cortex") (result f32)
    (global.get $cortex))

  (func (export "regular_impulso") (param f32) (result f32)
    (local $v f32)
    (local.set $v (local.get 0))
    (if (f32.lt (local.get $v) (f32.const 0))
      (then (local.set $v (f32.const 0))))
    (if (f32.gt (local.get $v) (f32.const 1))
      (then (local.set $v (f32.const 1))))
    (global.set $impulso (local.get $v))
    (f32.mul
      (f32.add (global.get $base) (f32.mul (global.get $cortex) (f32.const 2)))
      (f32.sub (f32.const 1) (f32.mul (local.get $v) (f32.const 0.15)))))

  (func (export "calcular_capacidade")
        (param $maturidade f32) (param $overclock f32)
        (param $decisao f32) (param $supremo i32)
        (result f32)
    (local $cap f32)
    (local.set $cap
      (f32.add (global.get $base) (f32.mul (local.get $maturidade) (f32.const 2.5))))
    (local.set $cap
      (f32.add (local.get $cap) (f32.mul (local.get $overclock) (f32.const 1.5))))
    (local.set $cap
      (f32.add (local.get $cap) (f32.mul (local.get $decisao) (f32.const 1.2))))
    (if (local.get $supremo)
      (then (local.set $cap (f32.const 10))))
    (f32.min (local.get $cap) (f32.const 10)))

  (func (export "simular_ciclo") (param $ticks i32) (param $carga f32) (result f32)
    (local $i i32)
    (local $acc f32)
    (block $exit
      (loop $loop
        (br_if $exit (i32.ge_s (local.get $i) (local.get $ticks)))
        (local.set $acc
          (f32.add (local.get $acc)
            (f32.mul
              (f32.add (global.get $base) (global.get $cortex))
              (f32.div (local.get $carga) (f32.const 100)))))
        (global.set $ciclos (i32.add (global.get $ciclos) (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    (f32.div (local.get $acc) (f32.convert_i32_s (local.get $ticks))))

  (func (export "ciclos") (result i32)
    (global.get $ciclos))

  (func (export "reset")
    (global.set $cortex (f32.const 0.58))
    (global.set $impulso (f32.const 0.5))
    (global.set $ciclos (i32.const 0)))

  (func (export "gravar_memoria") (param i32 i32)
    (i32.store8 (local.get 0) (local.get 1)))

  (func (export "ler_memoria") (param i32) (result i32)
    (i32.load8_u (local.get 0)))
)
