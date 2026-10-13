# ALIMUSIC v1 — "Yıldızlar Arası" ruhunda ÖZGÜN ambient org-pad döngüsü
# Telifsiz: orijinal kompozisyon (Hans Zimmer'in melodisi KOPYA DEĞİL, yalnızca tür/duygu benzer)
# Matematiksel olarak kusursuz (seamless) 24s loop:
#   - Tüm frekanslar f*24 tam sayı olacak biçimde nicelenir -> faz sürekliliği
#   - Akor pencereleri döngü sınırından sarılır (wrap) -> zarf sürekliliği
import numpy as np, wave

SR = 44100
LOOP = 24.0
N = int(SR * LOOP)
t = np.arange(N) / SR

def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def q24(f):
    """f * LOOP tam sayi olacak sekilde nicele (loop faz surekligi icin)."""
    return round(f * LOOP) / LOOP

# Akorlar (Dm -> Bb -> F -> C), midi notaları
CHORDS = [
    [50, 57, 62, 65],   # D3 A3 D4 F4  (Dm)
    [46, 53, 58, 62],   # Bb2 F3 Bb3 D4 (Bb)
    [53, 57, 60, 65],   # F3 A3 C4 F4  (F)
    [48, 55, 60, 64],   # C3 G3 C4 E4  (C)
]
CH_DUR, FADE = 6.0, 1.8
HARM = [(1, 1.0), (2, 0.38), (3, 0.18), (4, 0.09), (6, 0.035), (8, 0.018)]

def env_window(tau, span):
    """tau: [0,span) yerel zaman; 1.8s yukselen/dusen kosinus kenarlar."""
    e = np.ones_like(tau)
    rise = tau < FADE
    fall = tau > (span - FADE)
    e[rise] = 0.5 - 0.5 * np.cos(np.pi * tau[rise] / FADE)
    e[fall] = 0.5 - 0.5 * np.cos(np.pi * (span - tau[fall]) / FADE)
    return e

L = np.zeros(N)
R = np.zeros(N)

for i, chord in enumerate(CHORDS):
    span = CH_DUR + 2 * FADE
    tau = (t - (i * CH_DUR - FADE)) % LOOP          # wrap'li yerel zaman
    active = tau < span
    env = np.zeros(N)
    env[active] = env_window(tau[active], span)

    for m in chord:
        f0 = q24(midi_hz(m))
        sub = np.sin(2 * np.pi * q24(f0 / 2) * t)   # sub oktav (saf sinüs)
        for h, a in HARM:
            fc = q24(f0 * h)
            phL, phR = 0.0, 0.9 * h                 # hafif faz farki -> genislik
            L += a * env * np.sin(2 * np.pi * fc * t + phL)
            R += a * env * np.sin(2 * np.pi * fc * t + phR)
        L += 0.40 * env * sub
        R += 0.40 * env * sub

# Nefes alma LFO'su (1 dongu = 1/24 Hz -> periodik)
lfo = 1.0 + 0.10 * np.sin(2 * np.pi * (1 / LOOP) * t)
L *= lfo
R *= 1.0 + 0.10 * np.sin(2 * np.pi * (1 / LOOP) * t + 0.7)

# Uzak "tik" katmani (zaman motifi, cok kisik; 2s aralikla -> 12 adet, periodik)
tick_len = int(0.012 * SR)
tt = np.arange(tick_len) / SR
tick = np.exp(-tt * 900) * np.sin(2 * np.pi * 2400 * tt) * 0.05
for k in range(0, 12):
    s = int(k * 2.0 * SR)
    L[s:s + tick_len] += tick * 0.9
    R[s:s + tick_len] += tick * 0.7  # tik hafif solda

# Yogunluk esitle: RMS hedef + tepe siniri
mix = np.stack([L, R])
mix /= max(np.sqrt(np.mean(mix ** 2)), 1e-9)
mix *= 0.22
mix = np.clip(mix, -0.85, 0.85)

pcm = (mix.T * 32767).astype(np.int16)
with wave.open('/home/z/my-project/repo-analysis/music/arkaplan.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

print('WAV yazildi: 24s seamless loop, peak=%.2f' % np.max(np.abs(mix)))
