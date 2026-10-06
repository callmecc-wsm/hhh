"""用有限差分检查梯度，用对照实验检查训练信号。"""

import unittest

from fine_tune_and_distill import cross_entropy, distill_fit, distill_gradient, kl, linear_fit, softmax


class TrainingTests(unittest.TestCase):
    def test_no_steps_preserves_initial_parameters(self):
        result = linear_fit(0)
        self.assertEqual(result["w"], [2, -.4])
        self.assertEqual(result["b"], 0)
        self.assertEqual(len(result["losses"]), 1)

    def test_clean_labels_improve_clean_target_loss(self):
        result = linear_fit(60)
        self.assertLess(result["target"][-1], .25)
        self.assertLess(result["target"][-1], result["target"][0])

    def test_wrong_labels_can_lower_training_loss_but_harm_actual_goal(self):
        result = linear_fit(60, noise=4)
        self.assertLess(result["losses"][-1], result["losses"][0])
        self.assertGreater(result["target"][-1], result["target"][0])

    def test_distillation_decreases_distribution_distance(self):
        result = distill_fit(50)
        self.assertLess(result["history"][-1], .02)
        self.assertAlmostEqual(sum(result["student"]), 1)
        self.assertNotEqual(result["student"], result["serving"])

    def test_distillation_gradient_matches_finite_difference(self):
        teacher, logits = [3, 1, 0, -1], [.3, -.2, .5, -.1]
        for temperature, alpha in [(1, 0), (1, 1), (2, .8), (4, 1)]:
            with self.subTest(temperature=temperature, alpha=alpha):
                def objective(z):
                    return alpha * temperature ** 2 * kl(softmax(teacher, temperature), softmax(z, temperature)) + (1 - alpha) * cross_entropy([1, 0, 0, 0], softmax(z))
                analytic = distill_gradient(logits, teacher, temperature, alpha)
                epsilon = 1e-5
                for index in range(4):
                    plus, minus = logits[:], logits[:]
                    plus[index] += epsilon
                    minus[index] -= epsilon
                    numeric = (objective(plus) - objective(minus)) / (2 * epsilon)
                    self.assertAlmostEqual(analytic[index], numeric, places=7)

    def test_softmax_is_stable_and_shift_invariant(self):
        first, second = softmax([3, 1, 0, -1]), softmax([1003, 1001, 1000, 999])
        for p, q in zip(first, second):
            self.assertAlmostEqual(p, q)

    def test_invalid_training_parameters_are_rejected(self):
        for settings in [{"steps": -1}, {"lr": float("nan")}, {"noise": 5}, {"replay": -1}]:
            with self.subTest(settings=settings), self.assertRaises(ValueError):
                linear_fit(**settings)
        for settings in [{"temperature": 0}, {"alpha": 1.1}, {"teacher": [1, 2]}]:
            with self.subTest(settings=settings), self.assertRaises(ValueError):
                distill_fit(**settings)


if __name__ == "__main__":
    unittest.main(verbosity=2)
