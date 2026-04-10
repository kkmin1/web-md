# Hello World

This is a **Premium** Markdown Editor.

## Features
- Real-time preview
- Syntax highlighting
- Glassmorphism effect
- LaTeX support ( $E = mc^2$ )
<br>

## LaTeX 수식 Example
Inline math: $f(x) = \int_{-\infty}^\infty \hat{f}(\xi) e^{2\pi i \xi x} d\xi$
Inline math: \(f(x) = \int_{-\infty}^\infty \hat{f}(\xi) e^{2\pi i \xi x} d\xi \)
<br>
Block math: $$f(x) = \int_{-\infty}^\infty \hat{f}(\xi) e^{2\pi i \xi x} d\xi$$
Block math: \[ f(x) = \int_{-\infty}^\infty \hat{f}(\xi) e^{2\pi i \xi x} d\xi \]

행렬:

\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}


```javascript
function greet() {
  console.log("Hello from Nova!");
}
```
<br>

#### 용의자의 딜레마
| 갑/을 | 협조 | 배신 |
|---|---|---|
| **협조** | -1,-1 | -9,0 |
| **배신** | 0,-9 | -5,-5 |

## Matrix And TikZ Regression Tests

Bare matrix environment:
\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}

Wrapped matrix environment:
$$\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}$$

Cases environment:
\begin{cases}
-x, & \text{if } x < 0 \\
x, & \text{if } x \ge 0
\end{cases}

Wrapped cases environment:
$$\begin{cases}
-x, & \text{if } x < 0 \\
x, & \text{if } x \ge 0
\end{cases}$$

Escaped dollar test: price is \$5 and inline math is $x+1$.

Bare TikZ environment:
\begin{tikzpicture}
\draw[->] (0,0) -- (2,0);
\draw[->] (0,0) -- (0,2);
\draw (0,0) -- (1.4,1.2);
\end{tikzpicture}

Wrapped TikZ environment:
$$\begin{tikzpicture}
\draw[->] (0,0) -- (2,0);
\draw[->] (0,0) -- (0,2);
\draw (0,0) circle (0.8);
\end{tikzpicture}$$
